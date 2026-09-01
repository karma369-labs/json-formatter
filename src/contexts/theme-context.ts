import { createContext, type MouseEvent as ReactMouseEvent } from 'react';
import { loadTheme, saveTheme } from '../lib/storage';

export type Theme = 'dark' | 'light';

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: (event?: ReactMouseEvent | MouseEvent | { clientX: number; clientY: number }) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

// A minimal external store (read via useSyncExternalStore in ThemeContext.tsx)
// rather than plain useState: the real theme lives in localStorage/matchMedia,
// which don't exist during server/prerender rendering. useSyncExternalStore's
// getServerSnapshot lets the server and the client's first render agree on a
// placeholder ('dark') with no manual effect+setState — React reconciles to
// the real client value right after hydration on its own, without a
// hydration-mismatch warning (that manual-effect pattern is what's being
// avoided here; see ConsentBanner.tsx for the same technique).
let cachedTheme: Theme | null = null;
const listeners = new Set<() => void>();

function readTheme(): Theme {
  const stored = loadTheme();
  if (stored === 'dark' || stored === 'light') return stored;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getThemeSnapshot(): Theme {
  if (cachedTheme === null) cachedTheme = readTheme();
  return cachedTheme;
}

export function getServerThemeSnapshot(): Theme {
  return 'dark';
}

export function setStoredTheme(theme: Theme): void {
  cachedTheme = theme;
  saveTheme(theme);
  listeners.forEach((listener) => listener());
}
