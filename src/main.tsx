import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ConsentBanner } from './components/ConsentBanner.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'
import { installErrorTracking, track } from './lib/analytics.ts'

installErrorTracking();
track('app_loaded', {
  has_clipboard: typeof navigator !== 'undefined' && !!navigator.clipboard,
  has_view_transitions: typeof document !== 'undefined' && 'startViewTransition' in document,
  has_storage: (() => {
    try {
      return typeof localStorage !== 'undefined' && !!localStorage;
    } catch {
      return false;
    }
  })(),
});

const container = document.getElementById('root')!;
const tree = (
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
        <ConsentBanner />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);

// The prerender step fills #root with static markup; dev's index.html never
// runs that step, so the container is always empty there and this falls
// through to a normal client render.
if (container.hasChildNodes()) {
  hydrateRoot(container, tree);
} else {
  createRoot(container).render(tree);
}
