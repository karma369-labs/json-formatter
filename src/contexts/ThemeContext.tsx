import { useLayoutEffect, useSyncExternalStore, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  ThemeContext,
  getServerThemeSnapshot,
  getThemeSnapshot,
  setStoredTheme,
  subscribeTheme,
} from './theme-context';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // useSyncExternalStore rather than useState+effect: the real theme lives in
  // localStorage/matchMedia, unavailable during server/prerender rendering.
  // getServerThemeSnapshot lets the server and the client's first render
  // agree on a 'dark' placeholder; React reconciles to the real client value
  // right after hydration on its own, with no manual effect+setState and no
  // hydration-mismatch warning.
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function toggleTheme(event?: ReactMouseEvent | MouseEvent | { clientX: number; clientY: number }) {
    const next = theme === 'dark' ? 'light' : 'dark';
    const isReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isSupported = typeof document !== 'undefined' && 'startViewTransition' in document;

    if (!isSupported || isReduced) {
      setStoredTheme(next);
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
        setStoredTheme(next);
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
