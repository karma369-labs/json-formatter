// This is a build-time SSR entry, never part of the dev/HMR module graph, so
// re-exporting the route table alongside render() is fine here.
/* eslint-disable react-refresh/only-export-components */
// Build-time-only SSR entry point — never served, only imported by
// scripts/prerender.mjs after `vite build --ssr` compiles it to dist-ssr/.
// Renders the exact same component tree main.tsx mounts on the client
// (StrictMode > BrowserRouter > ThemeProvider > App + ConsentBanner) so
// hydrateRoot's first pass matches what's already in the static HTML. The only
// difference is StaticRouter here vs BrowserRouter on the client: both put the
// same location in context, so App resolves the same route on both sides.
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App';
import { ConsentBanner } from './components/ConsentBanner';
import { ThemeProvider } from './contexts/ThemeContext';

/** Render the app as HTML for a single route. `url` is the route path, e.g.
 *  '/validator' or '/converter/json-to-yaml'. */
export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <ThemeProvider>
          <App />
          <ConsentBanner />
        </ThemeProvider>
      </StaticRouter>
    </StrictMode>
  );
}

// Re-exported so prerender.mjs reads the route table off this compiled bundle
// rather than keeping its own copy — one source of truth for which files to
// emit and what <head> to stamp into each.
export { ROUTES, SITE_ORIGIN } from './routes';
