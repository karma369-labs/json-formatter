import { useState } from 'react';
import { Cookie } from 'lucide-react';
import { getStoredConsent, setConsent, track, type ConsentValue } from '../lib/analytics';
import './ConsentBanner.css';

// Mounted as a sibling of <App /> in main.tsx rather than inside it: position:
// fixed breaks if any ancestor ever picks up a transform/filter/contain.
export function ConsentBanner() {
  const [visible, setVisible] = useState(() => getStoredConsent() === null);

  if (!visible) return null;

  function choose(value: ConsentValue) {
    // Declining must persist too, otherwise the banner nags on every visit.
    setConsent(value);
    setVisible(false);
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
