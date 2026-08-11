import { createContext, type MouseEvent as ReactMouseEvent } from 'react';
import { loadTheme } from '../lib/storage';

export type Theme = 'dark' | 'light';

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: (event?: ReactMouseEvent | MouseEvent | { clientX: number; clientY: number }) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function getInitialTheme(): Theme {
  const stored = loadTheme();
  if (stored === 'dark' || stored === 'light') return stored;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}
