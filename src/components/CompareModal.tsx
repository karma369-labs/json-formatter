import { useRef, useState, type ChangeEvent } from 'react';
import { X, Upload, Plus, Minus, Pencil, GitCompare } from 'lucide-react';
import { parseJson, type ParseError } from '../lib/jsonParser';
import { diffJson, summarizeDiff, previewValue, type DiffOp } from '../lib/diff';
import { readTextFile } from '../lib/file';
import './CompareModal.css';

interface CompareModalProps {
  raw: string;
  parsed: unknown;
  error: ParseError | null;
  onClose: () => void;
}

const TYPE_META: Record<DiffOp['type'], { label: string; icon: typeof Plus; className: string }> = {
  add: { label: 'Added', icon: Plus, className: 'diff-add' },
  remove: { label: 'Removed', icon: Minus, className: 'diff-remove' },
  change: { label: 'Changed', icon: Pencil, className: 'diff-change' },
};

export function CompareModal({ raw, parsed, error, onClose }: CompareModalProps) {
  const [bRaw, setBRaw] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bResult = parseJson(bRaw);
  const bError = bRaw.trim() === '' ? null : bResult.success ? null : (bResult.error ?? null);

  let ops: DiffOp[] = [];
  if (!error && bRaw.trim() !== '' && !bError) {
    ops = diffJson(parsed, bResult.value);
  }
  const summary = summarizeDiff(ops);
  const canDiff = !error && bRaw.trim() !== '' && !bError;

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBRaw(await readTextFile(file));
  }

  return (
    <div className="compare-modal-backdrop" onMouseDown={onClose}>
      <div className="compare-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="compare-modal-header">
          <span>Compare JSON</span>
          <button type="button" className="button-tertiary button-icon-only" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>

        <div className="compare-modal-panes">
          <div className="compare-pane">
            <div className="compare-pane-header">
              <span>Document A (current editor)</span>
            </div>
            {error ? (
              <div className="compare-pane-error">Fix the syntax error in the editor before comparing.</div>
            ) : (
              <pre className="compare-pane-preview">{raw.trim() || '(empty)'}</pre>
            )}
          </div>

          <div className="compare-pane">
            <div className="compare-pane-header">
              <span>Document B</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json,text/plain"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                aria-hidden="true"
                tabIndex={-1}
              />
              <button
                type="button"
                className="button-tertiary button-icon-only"
                onClick={() => fileInputRef.current?.click()}
                title="Upload a JSON file to compare against"
              >
                <Upload size={13} />
              </button>
            </div>
            <textarea
              className="compare-pane-input"
              placeholder="Paste JSON to compare against Document A…"
              value={bRaw}
              onChange={(e) => setBRaw(e.target.value)}
              spellCheck={false}
            />
            {bError ? <div className="compare-pane-error">{bError.message}</div> : null}
          </div>
        </div>

        <div className="compare-modal-results">
          {!canDiff ? (
            <div className="compare-empty-state">
              <GitCompare size={28} style={{ opacity: 0.35 }} />
              <span>Paste or upload a valid JSON document into Document B to see the diff.</span>
            </div>
          ) : ops.length === 0 ? (
            <div className="compare-empty-state">
              <GitCompare size={28} style={{ opacity: 0.35 }} />
              <span>No differences — the two documents are structurally identical.</span>
            </div>
          ) : (
            <ul className="diff-op-list">
              {ops.map((op, i) => {
                const meta = TYPE_META[op.type];
                const Icon = meta.icon;
                return (
                  <li key={i} className={`diff-op ${meta.className}`}>
                    <span className="diff-op-badge">
                      <Icon size={11} />
                      <span>{meta.label}</span>
                    </span>
                    <span className="diff-op-path">{op.path}</span>
                    <span className="diff-op-value">
                      {op.type === 'change' ? (
                        <>
                          <span className="diff-op-old">{previewValue(op.oldValue)}</span>
                          <span className="diff-op-arrow">→</span>
                          <span className="diff-op-new">{previewValue(op.newValue)}</span>
                        </>
                      ) : op.type === 'add' ? (
                        <span className="diff-op-new">{previewValue(op.newValue)}</span>
                      ) : (
                        <span className="diff-op-old">{previewValue(op.oldValue)}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="compare-modal-footer">
          {canDiff ? (
            <span className="compare-summary">
              <span className="diff-add">{summary.added} added</span>
              <span className="diff-remove">{summary.removed} removed</span>
              <span className="diff-change">{summary.changed} changed</span>
            </span>
          ) : (
            <span className="compare-summary" />
          )}
        </div>
      </div>
    </div>
  );
}
