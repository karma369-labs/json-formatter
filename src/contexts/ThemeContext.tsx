import { useLayoutEffect, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { saveTheme } from '../lib/storage';
import { ThemeContext, getInitialTheme, type Theme } from './theme-context';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);

  function toggleTheme(event?: ReactMouseEvent | MouseEvent | { clientX: number; clientY: number }) {
    const isReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isSupported = typeof document !== 'undefined' && 'startViewTransition' in document;

    if (!isSupported || isReduced) {
      setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
      return;
    }

    const x = event && 'clientX' in event && typeof event.clientX === 'number' ? event.clientX : window.innerWidth / 2;
    const y = event && 'clientY' in event && typeof event.clientY === 'number' ? event.clientY : window.innerHeight / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = (document as unknown as { startViewTransition: (cb: () => void) => { ready: Promise<void> } }).startViewTransition(() => {
      flushSync(() => {
        setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
      });
    });

    transition.ready
      .then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`
        ];

        document.documentElement.animate(
          {
            clipPath,
          },
          {
            duration: 450,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      })
      // `ready` rejects when the transition is skipped or aborted (rapid
      // toggles, backgrounded tab). The theme has already been applied by
      // then — only the reveal animation is lost, so swallow it rather than
      // letting it surface as an unhandled rejection.
      .catch(() => {});
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
