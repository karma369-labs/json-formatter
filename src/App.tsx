import { useState, useEffect } from 'react';
import {
  Code2,
  Copy,
  Check,
  Download,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { ErrorBanner } from './components/ErrorBanner';
import { FileDropZone } from './components/FileDropZone';
import { JsonEditor } from './components/JsonEditor';
import { SnapshotsPanel } from './components/SnapshotsPanel';
import { Toolbar } from './components/Toolbar';
import { TreeView } from './components/TreeView';
import { useJsonEditor } from './hooks/useJsonEditor';
import './App.css';

const SAMPLE_JSON = JSON.stringify(
  {
    name: "json-studio",
    version: "1.0.0",
    description: "Fast, client-side JSON editor and inspector.",
    main: "src/main.tsx",
    scripts: {
      dev: "vite",
      build: "tsc -b && vite build"
    },
    dependencies: {
      react: "^19.0.0",
      codemirror: "^6.0.0"
    },
    private: true
  },
  null,
  2
);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function App() {
  const editor = useJsonEditor();
  const { state } = editor;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 768
  );
  const [copiedRaw, setCopiedRaw] = useState(false);

  const lineCount = state.raw ? state.raw.split('\n').length : 0;
  const byteSize = new Blob([state.raw]).size;

  // Global Keyboard Shortcuts (Cmd/Ctrl+Enter format, Cmd/Ctrl+M minify, Cmd/Ctrl+S sort)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (!state.error) editor.format();
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (!state.error) editor.minify();
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!state.error) editor.sortKeys();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, state.error]);

  async function handleCopyRaw() {
    await navigator.clipboard.writeText(state.raw);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 1200);
  }

  function handleDownload() {
    const blob = new Blob([state.raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `json-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    editor.setRaw('');
  }

  function handleLoadSample(content?: string) {
    editor.loadContent(content || SAMPLE_JSON);
  }

  return (
    <FileDropZone onFile={editor.loadContent}>
      <div className="app-container">
        <header className="top-nav">
          <div className="brand-title">
            <button
              type="button"
              className="button-tertiary button-icon-only"
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <span className="brand-icon">
              <Code2 size={18} />
            </span>
            <span>JSON Studio</span>
          </div>

          <div className="top-nav-meta">
            {state.raw.trim() ? (
              <>
                <span className="meta-pill">{lineCount} lines</span>
                <span>•</span>
                <span className="meta-pill">{formatBytes(byteSize)}</span>
              </>
            ) : null}
          </div>

          <div className="top-nav-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={handleCopyRaw}
              disabled={!state.raw.trim()}
              title="Copy JSON to clipboard"
            >
              {copiedRaw ? <Check size={14} style={{ color: 'var(--semantic-success)' }} /> : <Copy size={14} />}
              <span>Copy</span>
            </button>

            <button
              type="button"
              className="button-secondary"
              onClick={handleDownload}
              disabled={!state.raw.trim()}
              title="Download as JSON file"
            >
              <Download size={14} />
              <span>Download</span>
            </button>

            <button
              type="button"
              className="button-tertiary"
              onClick={handleClear}
              disabled={!state.raw.trim()}
              title="Clear editor"
            >
              <Trash2 size={14} style={{ color: state.raw.trim() ? 'var(--danger)' : undefined }} />
              <span>Clear</span>
            </button>
          </div>
        </header>

        <div className="app-body">
          {!sidebarCollapsed && (
            <div
              className="sidebar-backdrop"
              onClick={() => setSidebarCollapsed(true)}
              aria-hidden="true"
            />
          )}
          <SnapshotsPanel
            raw={state.raw}
            onLoad={editor.loadContent}
            collapsed={sidebarCollapsed}
          />

          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Toolbar
              indent={state.indent}
              error={state.error}
              hasContent={!!state.raw.trim()}
              viewMode={state.viewMode}
              onIndentChange={editor.setIndent}
              onFormat={editor.format}
              onMinify={editor.minify}
              onSortKeys={editor.sortKeys}
              onRepair={editor.repair}
              onViewModeChange={editor.setViewMode}
              onFileUpload={editor.loadContent}
              onLoadSample={handleLoadSample}
            />

            <ErrorBanner error={state.error} />

            <div className={`app-panes ${state.viewMode}`}>
              {state.viewMode === 'text' || state.viewMode === 'split' ? (
                <div className="product-panel">
                  <div className="panel-header">
                    <span>Source Text</span>
                    {state.raw.trim() ? (
                      <span style={{ fontSize: '10px', opacity: 0.7, textTransform: 'none' }}>
                        {lineCount} L
                      </span>
                    ) : null}
                  </div>
                  <JsonEditor value={state.raw} onChange={editor.setRaw} />
                </div>
              ) : null}

              {state.viewMode === 'tree' || state.viewMode === 'split' ? (
                <div className="product-panel">
                  <div className="panel-header">
                    <span>Tree Explorer</span>
                    {state.parsed !== undefined && !state.error ? (
                      <span style={{ fontSize: '10px', opacity: 0.7, textTransform: 'none' }}>
                        Interactive AST
                      </span>
                    ) : null}
                  </div>
                  <TreeView parsed={state.parsed} error={state.error} />
                </div>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </FileDropZone>
  );
}

export default App;
