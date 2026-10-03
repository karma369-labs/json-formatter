import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '../hooks/useModalFocus';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small yes/no dialog. Cancel comes first so useModalFocus focuses it, which
 *  makes a stray Enter keep the user's content instead of destroying it.
 *  Portaled to <body> because the mobile sidebar is its own stacking context
 *  and would otherwise trap the dialog under the toolbar. Only ever mounted
 *  from a user action, so document is always defined here. */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const containerRef = useModalFocus<HTMLDivElement>();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return createPortal(
    <div className="confirm-backdrop" onMouseDown={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        ref={containerRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="button-primary confirm-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
