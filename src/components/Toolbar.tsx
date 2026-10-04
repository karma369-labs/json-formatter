import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import {
  Upload,
  Wand2,
  Minimize2,
  ArrowUpDown,
  Code2,
  Network,
  Workflow,
  Columns,
  FolderOpen,
  Wrench,
  ChevronDown,
  FileJson,
  AlertTriangle,
  CheckCircle2,
  Shuffle,
  GitCompare,
  FileInput,
} from 'lucide-react';
import './Toolbar.css';
import type { IndentOption, ParseError } from '../lib/jsonParser';
import type { ViewMode } from '../hooks/useJsonEditor';
import { useHydrated } from '../hooks/useClientOnly';
import { readTextFile } from '../lib/file';
import { TEST_PAYLOADS, type SamplePayload } from '../data/samples';

interface ToolbarProps {
  indent: IndentOption;
  error: ParseError | null;
  hasContent: boolean;
  viewMode: ViewMode;
  splitView: boolean;
  onIndentChange: (indent: IndentOption) => void;
  onFormat: () => void;
  onMinify: () => void;
  onSortKeys: () => void;
  onRepair: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onSplitViewChange: (split: boolean) => void;
  onFileUpload: (content: string, fileName: string) => void;
  onLoadSample?: (content?: string) => void;
  onOpenConvert?: () => void;
  onOpenImport?: () => void;
  onOpenCompare?: () => void;
}

const INDENT_OPTIONS: { value: IndentOption; label: string }[] = [
  { value: 2, label: '2 spaces' },
  { value: 3, label: '3 spaces' },
  { value: 4, label: '4 spaces' },
  { value: 'tab', label: 'Tab' },
];

export function Toolbar({
  indent,
  error,
  hasContent,
  viewMode,
  splitView,
  onIndentChange,
  onFormat,
  onMinify,
  onSortKeys,
  onRepair,
  onViewModeChange,
  onSplitViewChange,
  onFileUpload,
  onLoadSample,
  onOpenConvert,
  onOpenImport,
  onOpenCompare,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSamplesMenu, setShowSamplesMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSamplesMenu(false);
      }
    }
    if (showSamplesMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSamplesMenu]);

  function handleIndentChange(e: ChangeEvent<HTMLSelectElement>) {
    const { value } = e.target;
    onIndentChange(value === 'tab' ? 'tab' : (Number(value) as IndentOption));
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await readTextFile(file);
    onFileUpload(text, file.name);
  }

  function handleSelectSample(payload: SamplePayload) {
    setShowSamplesMenu(false);
    if (onLoadSample) {
      onLoadSample(payload.content);
    } else {
      onFileUpload(payload.content, `${payload.id}.json`);
    }
  }

  // See the matching note in App.tsx — navigator.platform read unguarded in a
  // render path mismatches during hydration on every Mac.
  const hydrated = useHydrated();
  const isMac = hydrated && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl+';

  return (
    <div className="toolbar" role="toolbar">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json,text/plain"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Primary Actions Group */}
      <div className="toolbar-group">
        <button
          type="button"
          className="button-secondary"
          onClick={() => fileInputRef.current?.click()}
          title="Upload JSON file"
        >
          <Upload size={13} />
          <span>Upload</span>
        </button>

        {/* Test Payloads Dropdown */}
        <div className="sample-menu-wrapper" ref={menuRef}>
          <button
            type="button"
            className={`button-tertiary ${showSamplesMenu ? 'active' : ''}`}
            onClick={() => setShowSamplesMenu((prev) => !prev)}
            title="Load sample test payloads"
          >
            <FolderOpen size={13} />
            <span>Test Payloads</span>
            <ChevronDown size={12} style={{ opacity: 0.6 }} />
          </button>

          {showSamplesMenu && (
            <div className="sample-dropdown-menu">
              <div className="sample-menu-header">
                <FileJson size={14} />
                <span>Select Test Payload</span>
              </div>
              <div className="sample-menu-list">
                {TEST_PAYLOADS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    className="sample-menu-item"
                    onClick={() => handleSelectSample(sample)}
                  >
                    <div className="sample-item-top">
                      <span className="sample-item-name">{sample.name}</span>
                      <span className={`sample-badge category-${sample.category.toLowerCase().replace(/[^a-z]/g, '')}`}>
                        {sample.category}
                      </span>
                    </div>
                    <span className="sample-item-desc">{sample.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Formatting & Transform Controls */}
      <div className="toolbar-group">
        {error ? (
          <button
            type="button"
            className="button-primary button-autofix"
            onClick={onRepair}
            title="Auto-repair common JSON errors (quotes, trailing commas, comments)"
          >
            <Wrench size={13} />
            <span>Auto-Fix JSON</span>
          </button>
        ) : (
          <button
            type="button"
            className="button-secondary"
            onClick={onFormat}
            disabled={!hasContent}
            title={`Format & Beautify JSON (${modKey}Enter)`}
          >
            <Wand2 size={13} />
            <span>Format</span>
            <kbd className="toolbar-kbd">{modKey}↵</kbd>
          </button>
        )}

        <button
          type="button"
          className="button-secondary"
          onClick={onMinify}
          disabled={!hasContent || !!error}
          title={`Minify JSON (${modKey}M)`}
        >
          <Minimize2 size={13} />
          <span>Minify</span>
          <kbd className="toolbar-kbd">{modKey}M</kbd>
        </button>

        <button
          type="button"
          className="button-secondary"
          onClick={onSortKeys}
          disabled={!hasContent || !!error}
          title={`Alphabetically sort object keys recursively (${modKey}S)`}
        >
          <ArrowUpDown size={13} />
          <span>Sort Keys</span>
          <kbd className="toolbar-kbd">{modKey}S</kbd>
        </button>

        <button
          type="button"
          className="button-secondary"
          onClick={onOpenConvert}
          disabled={!hasContent || !!error || !onOpenConvert}
          title="Convert JSON to XML, CSV, TSV, YAML, or an escaped string"
        >
          <Shuffle size={13} />
          <span>Convert</span>
        </button>

        <button
          type="button"
          className="button-secondary"
          onClick={onOpenImport}
          disabled={!onOpenImport}
          title="Convert CSV, TSV, XML, or YAML into JSON"
        >
          <FileInput size={13} />
          <span>Import</span>
        </button>

        <button
          type="button"
          className="button-secondary"
          onClick={onOpenCompare}
          disabled={!hasContent || !!error || !onOpenCompare}
          title="Compare current JSON against another document"
        >
          <GitCompare size={13} />
          <span>Compare</span>
        </button>

        <div className="select-wrapper" title="Indent width">
          <select className="toolbar-select" value={indent} onChange={handleIndentChange} aria-label="Indent width">
            {INDENT_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="select-chevron" />
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Status indicator pill if content exists */}
      {hasContent ? (
        <>
          <div className="toolbar-status-pill">
            {error ? (
              <span className="status-badge status-error" title="Syntax Error in JSON">
                <AlertTriangle size={11} />
                <span>Syntax Error</span>
              </span>
            ) : (
              <span className="status-badge status-valid" title="Valid JSON structure">
                <CheckCircle2 size={11} />
                <span>Valid</span>
              </span>
            )}
          </div>
          <div className="toolbar-divider" />
        </>
      ) : null}

      {/* View Mode Selector Tabs */}
      <div className="view-mode-tabs" role="group" aria-label="View Mode">
        <button
          type="button"
          className={`view-mode-tab${viewMode === 'text' ? ' selected' : ''}`}
          onClick={() => onViewModeChange('text')}
          title="Raw Editor View"
        >
          <Code2 size={13} />
          <span>Raw</span>
        </button>

        <button
          type="button"
          className={`view-mode-tab${viewMode === 'tree' ? ' selected' : ''}`}
          onClick={() => onViewModeChange('tree')}
          disabled={!hasContent || !!error}
          title="Tree Inspector View"
        >
          <Network size={13} />
          <span>Tree</span>
        </button>

        <button
          type="button"
          className={`view-mode-tab${viewMode === 'graph' ? ' selected' : ''}`}
          onClick={() => onViewModeChange('graph')}
          disabled={!hasContent || !!error}
          title="Graph Explorer View"
        >
          <Workflow size={13} />
          <span>Graph</span>
        </button>

        <button
          type="button"
          className={`view-mode-tab${splitView ? ' selected' : ''}`}
          onClick={() => onSplitViewChange(!splitView)}
          disabled={viewMode === 'text' || !hasContent || !!error}
          title={`Split with Raw Editor (currently ${viewMode === 'tree' ? 'Tree' : 'Graph'})`}
        >
          <Columns size={13} />
          <span>Split</span>
        </button>
      </div>
    </div>
  );
}

