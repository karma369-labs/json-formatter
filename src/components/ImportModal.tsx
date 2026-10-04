import { useDeferredValue, useRef, useState } from 'react';
import { X, Copy, Check, FileSpreadsheet, FileCode, Braces, Upload, ArrowRightToLine } from 'lucide-react';
import {
  DEFAULT_IMPORT_OPTIONS,
  importToJson,
  type ImportFormat,
  type ImportOptions,
} from '../lib/importers';
import { formatJson, type IndentOption } from '../lib/jsonParser';
import { readTextFile } from '../lib/file';
import { useModalFocus } from '../hooks/useModalFocus';
import { sizeBucket, track } from '../lib/analytics';
import './ConvertModal.css';
import './ImportModal.css';

interface ImportModalProps {
  indent: IndentOption;
  /** Replace the editor document with the converted JSON text. The parent
   *  confirms with the user first and closes this modal when it applies. */
  onLoad: (json: string) => void;
  onClose: () => void;
  /** Preselect a source format (used by the /converter/*-to-json routes). */
  initialFormat?: ImportFormat;
}

const FORMATS: { value: ImportFormat; label: string; icon: typeof FileCode; accept: string; placeholder: string }[] = [
  {
    value: 'csv',
    label: 'CSV / TSV',
    icon: FileSpreadsheet,
    accept: '.csv,.tsv,.txt,text/csv,text/tab-separated-values',
    placeholder: 'name,age,city\nAda,36,London\nLinus,28,Helsinki',
  },
  {
    value: 'xml',
    label: 'XML',
    icon: FileCode,
    accept: '.xml,application/xml,text/xml',
    placeholder: '<user id="1">\n  <name>Ada</name>\n  <role>admin</role>\n</user>',
  },
  {
    value: 'yaml',
    label: 'YAML',
    icon: Braces,
    accept: '.yaml,.yml,application/x-yaml,text/yaml',
    placeholder: 'name: Ada\nage: 36\nlanguages:\n  - en\n  - fr',
  },
];

export function ImportModal({ indent, onLoad, onClose, initialFormat }: ImportModalProps) {
  const [format, setFormat] = useState<ImportFormat>(initialFormat ?? 'csv');
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS);
  const [copied, setCopied] = useState(false);
  const containerRef = useModalFocus<HTMLDivElement>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Converting a large paste on every keystroke would stall typing, so the
  // preview lags behind the textarea instead.
  const deferredInput = useDeferredValue(input);
  const current = FORMATS.find((f) => f.value === format)!;

  let output = '';
  let importError: string | null = null;
  if (deferredInput.trim()) {
    try {
      output = formatJson(importToJson(format, deferredInput, options), indent);
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Conversion failed.';
    }
  }
  const ready = !!output && !importError && deferredInput === input;

  async function handleFile(file: File) {
    const text = await readTextFile(file);
    setInput(text);
    track('import_file', { import_format: format, size_bucket: sizeBucket(text.length) });
  }

  async function handleCopy() {
    if (!ready) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    track('import_copy', { import_format: format, size_bucket: sizeBucket(output.length) });
  }

  function handleLoad() {
    if (!ready) return;
    track('import_load', { import_format: format, size_bucket: sizeBucket(output.length) });
    // The parent closes this modal once the load goes through. If the user
    // cancels the replace prompt, the modal stays open with their input intact.
    onLoad(output);
  }

  function setOption(key: keyof ImportOptions, value: boolean) {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="convert-modal-backdrop" onMouseDown={onClose}>
      <div
        className="convert-modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import to JSON"
        ref={containerRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="convert-modal-header">
          <span>Import to JSON</span>
          <button
            type="button"
            className="button-tertiary button-icon-only"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="convert-modal-tabs" role="tablist">
          {FORMATS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={format === value}
              className={`convert-tab${format === value ? ' selected' : ''}`}
              onClick={() => {
                track('import_format_select', { import_format: value });
                setFormat(value);
              }}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}

          {format !== 'yaml' ? (
            <div className="import-options">
              {format === 'csv' ? (
                <label>
                  <input
                    type="checkbox"
                    checked={options.headerRow}
                    onChange={(e) => setOption('headerRow', e.target.checked)}
                  />
                  First row is header
                </label>
              ) : null}
              <label title='Turn "42", "true" and "null" into numbers, booleans and null'>
                <input
                  type="checkbox"
                  checked={options.inferTypes}
                  onChange={(e) => setOption('inferTypes', e.target.checked)}
                />
                Detect types
              </label>
            </div>
          ) : null}
        </div>

        <div className="import-modal-panes">
          <textarea
            className="import-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={current.placeholder}
            spellCheck={false}
            aria-label={`${current.label} input`}
          />
          <div className="convert-modal-body import-output-pane">
            {importError ? (
              <div className="convert-error">{importError}</div>
            ) : (
              <pre className="convert-output">{output || 'JSON output appears here.'}</pre>
            )}
          </div>
        </div>

        <div className="convert-modal-footer">
          <input
            ref={fileInputRef}
            type="file"
            accept={current.accept}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
          <button type="button" className="button-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} />
            <span>Open file</span>
          </button>
          <button type="button" className="button-secondary" onClick={handleCopy} disabled={!ready}>
            {copied ? <Check size={13} style={{ color: 'var(--semantic-success)' }} /> : <Copy size={13} />}
            <span>Copy JSON</span>
          </button>
          <button
            type="button"
            className="button-primary import-load"
            onClick={handleLoad}
            disabled={!ready}
            title="Replace the editor content with this JSON"
          >
            <ArrowRightToLine size={13} />
            <span>Load into editor</span>
          </button>
        </div>
      </div>
    </div>
  );
}
