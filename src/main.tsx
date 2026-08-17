import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
      <ConsentBanner />
    </ThemeProvider>
  </StrictMode>,
)
