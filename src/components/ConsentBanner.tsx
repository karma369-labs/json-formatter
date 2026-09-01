import { useState, useSyncExternalStore } from 'react';
import { Cookie } from 'lucide-react';
import { getStoredConsent, setConsent, track, type ConsentValue } from '../lib/analytics';
import './ConsentBanner.css';

function subscribeNoop(): () => void {
  return () => {};
}

function getServerConsentSnapshot(): ConsentValue | null {
  return null;
}

// Mounted as a sibling of <App /> in main.tsx rather than inside it: position:
// fixed breaks if any ancestor ever picks up a transform/filter/contain.
//
// Reads stored consent via useSyncExternalStore rather than useState+effect:
// localStorage doesn't exist during server/prerender rendering, so
// getServerConsentSnapshot lets the server and the client's first render
// agree (banner visible, as if no consent were stored yet); React then
// reconciles to the real client value right after hydration on its own, with
// no hydration-mismatch warning. subscribe is a no-op since the only writer
// of consent is this same component's own click handler, which re-renders it
// directly via `dismissed`.
export function ConsentBanner() {
  const [dismissed, setDismissed] = useState(false);
  const consent = useSyncExternalStore(subscribeNoop, getStoredConsent, getServerConsentSnapshot);
  const visible = !dismissed && consent === null;

  if (!visible) return null;

  function choose(value: ConsentValue) {
    // Declining must persist too, otherwise the banner nags on every visit.
    setConsent(value);
    setDismissed(true);
    track('consent_choice', { consent_state: value });
  }

  return (
    <div className="consent-banner" role="dialog" aria-label="Cookie consent">
      <div className="consent-banner-copy">
        <Cookie size={16} className="consent-banner-icon" aria-hidden="true" />
        <p>
          JSON Studio uses analytics cookies to understand which tools get used. Your JSON never
          leaves your browser either way.
        </p>
      </div>
      <div className="consent-banner-actions">
        <button type="button" className="button-tertiary" onClick={() => choose('denied')}>
          Decline
        </button>
        <button type="button" className="button-primary" onClick={() => choose('granted')}>
          Accept
        </button>
      </div>
    </div>
  );
}
