import { useState } from 'react';
import { X, Copy, Check, Download, FileCode, FileSpreadsheet, FileText, Braces, Quote, FileJson2, FileType } from 'lucide-react';
import { convertJson, type ConverterFormat } from '../lib/converters';
import { useModalFocus } from '../hooks/useModalFocus';
import { sizeBucket, track } from '../lib/analytics';
import './ConvertModal.css';

interface ConvertModalProps {
  raw: string;
  parsed: unknown;
  onClose: () => void;
}

const FORMATS: { value: ConverterFormat; label: string; icon: typeof FileCode }[] = [
  { value: 'xml', label: 'XML', icon: FileCode },
  { value: 'csv', label: 'CSV', icon: FileSpreadsheet },
  { value: 'tsv', label: 'TSV', icon: FileSpreadsheet },
  { value: 'yaml', label: 'YAML', icon: Braces },
  { value: 'schema', label: 'JSON Schema', icon: FileJson2 },
  { value: 'typescript', label: 'TypeScript', icon: FileType },
  { value: 'escape', label: 'Escape', icon: Quote },
  { value: 'unescape', label: 'Unescape', icon: FileText },
];

export function ConvertModal({ raw, parsed, onClose }: ConvertModalProps) {
  const [format, setFormat] = useState<ConverterFormat>('xml');
  const [copied, setCopied] = useState(false);
  const containerRef = useModalFocus<HTMLDivElement>();

  let output = '';
  let convertError: string | null = null;
  let fileExtension = 'txt';
  let mimeType = 'text/plain';
  try {
    const result = convertJson(format, raw, parsed);
    output = result.output;
    fileExtension = result.fileExtension;
    mimeType = result.mimeType;
  } catch (err) {
    convertError = err instanceof Error ? err.message : 'Conversion failed.';
  }

  async function handleCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    track('convert_copy', { convert_format: format, size_bucket: sizeBucket(output.length) });
  }

  function handleDownload() {
    if (!output) return;
    const blob = new Blob([output], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted-${Date.now()}.${fileExtension}`;
    a.click();
    URL.revokeObjectURL(url);
    track('convert_download', { convert_format: format, size_bucket: sizeBucket(output.length) });
  }

  return (
    <div className="convert-modal-backdrop" onMouseDown={onClose}>
      <div
        className="convert-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Convert JSON"
        ref={containerRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="convert-modal-header">
          <span>Convert JSON</span>
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
                track('convert_format_select', { convert_format: value });
                setFormat(value);
              }}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="convert-modal-body">
          {convertError ? (
            <div className="convert-error">{convertError}</div>
          ) : (
            <pre className="convert-output">{output || '(empty output)'}</pre>
          )}
        </div>

        <div className="convert-modal-footer">
          <button
            type="button"
            className="button-secondary"
            onClick={handleCopy}
            disabled={!output || !!convertError}
          >
            {copied ? <Check size={13} style={{ color: 'var(--semantic-success)' }} /> : <Copy size={13} />}
            <span>Copy</span>
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={handleDownload}
            disabled={!output || !!convertError}
          >
            <Download size={13} />
            <span>Download .{fileExtension}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
