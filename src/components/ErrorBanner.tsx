import { AlertTriangle } from 'lucide-react';
import type { ParseError } from '../lib/jsonParser';
import './ErrorBanner.css';

interface ErrorBannerProps {
  error: ParseError | null;
  onRepair?: () => void;
}

export function ErrorBanner({ error }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="error-banner" role="alert">
      <div className="error-badge-pos">
        <AlertTriangle size={13} />
        <span>Ln {error.line}, Col {error.column}</span>
      </div>
      <span className="error-message-text" title={error.message}>
        {error.message}
      </span>
    </div>
  );
}
