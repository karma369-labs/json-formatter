import { useState, useEffect } from 'react';
import {
  Code2,
  Copy,
  Check,
  Download,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Wand2,
  Minimize2,
  ArrowUpDown,
  Wrench,
  Shuffle,
  GitCompare,
  Network,
  Workflow,
  Columns,
  FileJson,
  Command as CommandIcon,
} from 'lucide-react';
import { ErrorBanner } from './components/ErrorBanner';
import { FileDropZone } from './components/FileDropZone';
import { JsonEditor } from './components/JsonEditor';
import { GraphView } from './components/GraphView';
import { SnapshotsPanel } from './components/SnapshotsPanel';
import { Toolbar } from './components/Toolbar';
import { TreeView } from './components/TreeView';
import { ConvertModal } from './components/ConvertModal';
import { CompareModal } from './components/CompareModal';
import { CommandPalette, type Command } from './components/CommandPalette';
import { useJsonEditor } from './hooks/useJsonEditor';
import { useTheme } from './hooks/useTheme';
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
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 768
  );
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  const lineCount = state.raw ? state.raw.split('\n').length : 0;
  const byteSize = new Blob([state.raw]).size;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl+';

  // Global Keyboard Shortcuts: Cmd/Ctrl+Enter format, +M minify, +S sort,
  // +K command palette, +B toggle sidebar, Escape closes the topmost overlay.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (showPalette) setShowPalette(false);
        else if (showConvert) setShowConvert(false);
        else if (showCompare) setShowCompare(false);
        return;
      }
      if (!mod || e.shiftKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!state.error) editor.format();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (!state.error) editor.minify();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!state.error) editor.sortKeys();
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowPalette((v) => !v);
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarCollapsed((c) => !c);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, state.error, showPalette, showConvert, showCompare]);

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

  const hasContent = !!state.raw.trim();
  const commands: Command[] = [
    { id: 'format', label: 'Format & Beautify JSON', shortcut: `${modKey}Enter`, icon: Wand2, action: editor.format, disabled: !hasContent || !!state.error },
    { id: 'minify', label: 'Minify JSON', shortcut: `${modKey}M`, icon: Minimize2, action: editor.minify, disabled: !hasContent || !!state.error },
    { id: 'sort', label: 'Sort Keys Alphabetically', shortcut: `${modKey}S`, icon: ArrowUpDown, action: editor.sortKeys, disabled: !hasContent || !!state.error },
    { id: 'repair', label: 'Auto-Fix JSON Errors', icon: Wrench, action: editor.repair, disabled: !state.error },
    { id: 'convert', label: 'Convert JSON (XML, CSV, TSV, YAML…)', icon: Shuffle, action: () => setShowConvert(true), disabled: !hasContent || !!state.error },
    { id: 'compare', label: 'Compare JSON Documents', icon: GitCompare, action: () => setShowCompare(true), disabled: !hasContent || !!state.error },
    { id: 'view-raw', label: 'View: Raw Editor', icon: Code2, action: () => editor.setViewMode('text') },
    { id: 'view-tree', label: 'View: Tree Explorer', icon: Network, action: () => editor.setViewMode('tree'), disabled: !hasContent || !!state.error },
    { id: 'view-graph', label: 'View: Graph Explorer', icon: Workflow, action: () => editor.setViewMode('graph'), disabled: !hasContent || !!state.error },
    { id: 'view-split', label: 'View: Split', icon: Columns, action: () => editor.setViewMode('split'), disabled: !hasContent || !!state.error },
    {
      id: 'theme',
      label: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      icon: theme === 'dark' ? Sun : Moon,
      action: toggleTheme,
    },
    { id: 'copy', label: 'Copy JSON to Clipboard', icon: Copy, action: handleCopyRaw, disabled: !hasContent },
    { id: 'download', label: 'Download as .json', icon: Download, action: handleDownload, disabled: !hasContent },
    { id: 'clear', label: 'Clear Editor', icon: Trash2, action: handleClear, disabled: !hasContent },
    {
      id: 'sidebar',
      label: sidebarCollapsed ? 'Show Snapshots Sidebar' : 'Hide Snapshots Sidebar',
      shortcut: `${modKey}B`,
      icon: sidebarCollapsed ? PanelLeftOpen : PanelLeftClose,
      action: () => setSidebarCollapsed((c) => !c),
    },
    { id: 'sample', label: 'Load Sample JSON', icon: FileJson, action: () => handleLoadSample() },
  ];

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
              className="button-tertiary"
              onClick={() => setShowPalette(true)}
              title={`Command palette (${modKey}K)`}
            >
              <CommandIcon size={14} />
              <span>Commands</span>
              <kbd className="toolbar-kbd">{modKey}K</kbd>
            </button>

            <button
              type="button"
              className="button-tertiary button-icon-only"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

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
              onOpenConvert={() => setShowConvert(true)}
              onOpenCompare={() => setShowCompare(true)}
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

              {state.viewMode === 'graph' ? (
                <div className="product-panel">
                  <div className="panel-header">
                    <span>Graph Explorer</span>
                    {state.parsed !== undefined && !state.error ? (
                      <span style={{ fontSize: '10px', opacity: 0.7, textTransform: 'none' }}>
                        Debugger-style Graph
                      </span>
                    ) : null}
                  </div>
                  <GraphView parsed={state.parsed} error={state.error} />
                </div>
              ) : null}
            </div>
          </main>
        </div>

        {showConvert ? (
          <ConvertModal raw={state.raw} parsed={state.parsed} onClose={() => setShowConvert(false)} />
        ) : null}

        {showCompare ? (
          <CompareModal
            raw={state.raw}
            parsed={state.parsed}
            error={state.error}
            onClose={() => setShowCompare(false)}
          />
        ) : null}

        {showPalette ? <CommandPalette commands={commands} onClose={() => setShowPalette(false)} /> : null}
      </div>
    </FileDropZone>
  );
}

export default App;
