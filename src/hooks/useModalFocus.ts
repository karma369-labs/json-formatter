import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])';

/** Focuses the first focusable element on mount, traps Tab within the container, and restores focus to the previously focused element on unmount. */
export function useModalFocus<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusable = container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable ?? container)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled')
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return containerRef;
}
