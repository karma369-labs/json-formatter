// Build-time-only SSR entry point — never served, only imported by
// scripts/prerender.mjs after `vite build --ssr` compiles it to dist-ssr/.
// Renders the exact same component tree main.tsx mounts on the client
// (StrictMode > ThemeProvider > App + ConsentBanner) so hydrateRoot's first
// pass matches what's already in the static HTML.
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';
import { ConsentBanner } from './components/ConsentBanner';
import { ThemeProvider } from './contexts/ThemeContext';

export function render(): string {
  return renderToString(
    <StrictMode>
      <ThemeProvider>
        <App />
        <ConsentBanner />
      </ThemeProvider>
    </StrictMode>
  );
}
