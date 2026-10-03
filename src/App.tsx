import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
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
  FileInput,
  Command as CommandIcon,
} from 'lucide-react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ErrorBanner } from './components/ErrorBanner';
import { FileDropZone } from './components/FileDropZone';
import { JsonEditor } from './components/JsonEditor';
import { SiteFooter } from './components/SiteFooter';
import { SnapshotsPanel } from './components/SnapshotsPanel';
import { Toolbar } from './components/Toolbar';
import { TreeView } from './components/TreeView';
import type { Command } from './components/CommandPalette';
import { useHydrated, useMediaQuery } from './hooks/useClientOnly';
import { useJsonEditor, type ViewMode } from './hooks/useJsonEditor';
import { useTheme } from './hooks/useTheme';
import { getRouteByPath } from './routes';
import { sizeBucket, track, trackPageView } from './lib/analytics';
import './App.css';

const GraphView = lazy(() => import('./components/GraphView').then((m) => ({ default: m.GraphView })));
const ConvertModal = lazy(() => import('./components/ConvertModal').then((m) => ({ default: m.ConvertModal })));
const ImportModal = lazy(() => import('./components/ImportModal').then((m) => ({ default: m.ImportModal })));
const CompareModal = lazy(() => import('./components/CompareModal').then((m) => ({ default: m.CompareModal })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })));

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

const VIEW_MODE_TITLES: Record<ViewMode, string> = {
  text: 'Raw Editor',
  tree: 'Tree Explorer',
  graph: 'Graph Explorer',
};

type ActionSource = 'toolbar' | 'shortcut' | 'palette';

function App() {
  // The URL selects which tool this is. Server (StaticRouter) and client
  // (BrowserRouter) both put the same location in context, so the route
  // resolves identically on the SSR render and the hydration render.
  const location = useLocation();
  const route = getRouteByPath(location.pathname);
  const editor = useJsonEditor(route.defaultView);
  const { state } = editor;
  const { theme, toggleTheme } = useTheme();
  // Collapsed by default on narrow viewports, but an explicit user toggle wins
  // from then on. Split this way (rather than seeding useState from
  // window.innerWidth) because a useState initializer also runs during
  // hydration, where the prerendered HTML was built with no window at all —
  // on a phone that disagreement is a hydration mismatch.
  const isNarrow = useMediaQuery('(max-width: 768px)');
  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  const sidebarCollapsed = sidebarOverride ?? isNarrow;
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  // Manual modal opens (toolbar / command palette). Route-driven auto-opens
  // (the /converter/* and /compare landings) are layered on top of these,
  // gated behind useHydrated so a lazy modal never renders during SSR — that
  // would throw React #419, the same reason viewMode's graph default is gated.
  const [convertManual, setConvertManual] = useState(false);
  const [compareManual, setCompareManual] = useState(false);
  const [importManual, setImportManual] = useState(false);
  const [autoModalClosed, setAutoModalClosed] = useState(false);
  // A destructive change waiting for the user's yes. See confirmReplace below.
  const [pendingReplace, setPendingReplace] = useState<{ kind: 'replace' | 'clear'; apply: () => void } | null>(null);

  const lineCount = state.raw ? state.raw.split('\n').length : 0;
  const isSplit = state.splitView && state.viewMode !== 'text';
  const byteSize = new Blob([state.raw]).size;

  // Gated on useHydrated so the server render and the client's hydration
  // render both produce 'Ctrl+'; the real platform key swaps in right after.
  // Reading navigator.platform unguarded here would mismatch on every Mac.
  const hydrated = useHydrated();
  const isMac = hydrated && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl+';

  // A converter/compare landing opens its modal once the app has hydrated.
  // Manual opens win; closing either kind sets autoModalClosed so the route's
  // auto-open doesn't immediately reappear.
  const showConvert = convertManual || (hydrated && route.convertTo != null && !autoModalClosed);
  const showCompare = compareManual || (hydrated && !!route.opensCompare && !autoModalClosed);
  const showImport = importManual || (hydrated && route.importFrom != null && !autoModalClosed);

  // Kept in a ref (same pattern as JsonEditor's onChangeRef) so the shortcut
  // effect below doesn't resubscribe on every render just to see a fresh
  // runAction — and so we don't hand-write a useCallback the compiler handles.
  const runActionRef = useRef(runAction);
  useEffect(() => {
    runActionRef.current = runAction;
  });

  // Global Keyboard Shortcuts: Cmd/Ctrl+Enter format, +M minify, +S sort,
  // +K command palette, +B toggle sidebar, Escape closes the topmost overlay.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (pendingReplace) setPendingReplace(null);
        else if (showPalette) setShowPalette(false);
        else if (showConvert) { setConvertManual(false); setAutoModalClosed(true); }
        else if (showCompare) { setCompareManual(false); setAutoModalClosed(true); }
        else if (showImport) { setImportManual(false); setAutoModalClosed(true); }
        return;
      }
      if (!mod || e.shiftKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!state.error) runActionRef.current('format', 'shortcut');
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (!state.error) runActionRef.current('minify', 'shortcut');
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!state.error) runActionRef.current('sort_keys', 'shortcut');
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Track outside the updater — StrictMode double-invokes updaters.
        if (!showPalette) track('modal_open', { modal: 'palette', source: 'shortcut' });
        setShowPalette(!showPalette);
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        track('sidebar_toggle', { collapsed: !sidebarCollapsed, source: 'shortcut' });
        setSidebarOverride(!sidebarCollapsed);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.error, showPalette, showConvert, showCompare, showImport, pendingReplace, sidebarCollapsed]);

  // Every format/minify/sort/repair entry point (toolbar, keyboard, palette)
  // funnels through here so the event carries where it was triggered from.
  function runAction(action: 'format' | 'minify' | 'sort_keys' | 'repair', source: ActionSource) {
    track('json_action', {
      action,
      source,
      size_bucket: sizeBucket(state.raw.length),
      had_error: !!state.error,
    });
    if (action === 'format') editor.format();
    else if (action === 'minify') editor.minify();
    else if (action === 'sort_keys') editor.sortKeys();
    else editor.repair();
  }

  function handleViewModeChange(mode: ViewMode, source: ActionSource) {
    if (mode !== state.viewMode) {
      track('view_mode_change', { view_mode: mode, source });
      trackPageView(`/${mode}`, `JSON Studio — ${VIEW_MODE_TITLES[mode]}`);
    }
    editor.setViewMode(mode);
  }

  function handleSplitViewChange(split: boolean, source: ActionSource) {
    track('split_view_toggle', { enabled: split, view_mode: state.viewMode, source });
    editor.setSplitView(split);
  }

  // Every path that replaces or clears the document goes through here, so the
  // user is asked before losing work. An empty editor, or content identical to
  // what's incoming, has nothing to lose and applies straight away.
  function confirmReplace(next: string, apply: () => void) {
    if (!state.raw.trim() || state.raw === next) {
      apply();
      return;
    }
    setPendingReplace({ kind: next === '' ? 'clear' : 'replace', apply });
  }

  // fileName is deliberately NOT sent — only its extension, which is shape.
  function handleFileLoad(content: string, fileName: string, source: 'upload' | 'drop') {
    confirmReplace(content, () => {
      const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : undefined;
      track('file_loaded', { source, file_extension: ext, size_bucket: sizeBucket(content.length) });
      editor.loadContent(content);
    });
  }

  async function handleCopyRaw() {
    await navigator.clipboard.writeText(state.raw);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 1200);
    track('copy_json', { size_bucket: sizeBucket(state.raw.length) });
  }

  function handleDownload() {
    const blob = new Blob([state.raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `json-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    track('download_json', { size_bucket: sizeBucket(state.raw.length) });
  }

  function handleClear() {
    confirmReplace('', () => {
      track('clear_editor', { size_bucket: sizeBucket(state.raw.length) });
      editor.setRaw('');
    });
  }

  function handleLoadSample(content?: string) {
    const next = content || SAMPLE_JSON;
    confirmReplace(next, () => {
      track('load_sample', { is_default_sample: !content });
      editor.loadContent(next);
    });
  }

  function handleToggleTheme(e?: React.MouseEvent) {
    track('theme_toggle', { theme_to: theme === 'dark' ? 'light' : 'dark' });
    toggleTheme(e);
  }

  function handleOpenModal(modal: 'convert' | 'compare' | 'import' | 'palette', source: ActionSource) {
    track('modal_open', { modal, source });
    if (modal === 'convert') setConvertManual(true);
    else if (modal === 'compare') setCompareManual(true);
    else if (modal === 'import') setImportManual(true);
    else setShowPalette(true);
  }

  const hasContent = !!state.raw.trim();
  const commands: Command[] = [
    { id: 'format', label: 'Format & Beautify JSON', shortcut: `${modKey}Enter`, icon: Wand2, action: () => runAction('format', 'palette'), disabled: !hasContent || !!state.error },
    { id: 'minify', label: 'Minify JSON', shortcut: `${modKey}M`, icon: Minimize2, action: () => runAction('minify', 'palette'), disabled: !hasContent || !!state.error },
    { id: 'sort', label: 'Sort Keys Alphabetically', shortcut: `${modKey}S`, icon: ArrowUpDown, action: () => runAction('sort_keys', 'palette'), disabled: !hasContent || !!state.error },
    { id: 'repair', label: 'Auto-Fix JSON Errors', icon: Wrench, action: () => runAction('repair', 'palette'), disabled: !state.error },
    { id: 'convert', label: 'Convert JSON (XML, CSV, TSV, YAML…)', icon: Shuffle, action: () => handleOpenModal('convert', 'palette'), disabled: !hasContent || !!state.error },
    { id: 'import', label: 'Import to JSON (CSV, XML, YAML)', icon: FileInput, action: () => handleOpenModal('import', 'palette') },
    { id: 'compare', label: 'Compare JSON Documents', icon: GitCompare, action: () => handleOpenModal('compare', 'palette'), disabled: !hasContent || !!state.error },
    { id: 'view-raw', label: 'View: Raw Editor', icon: Code2, action: () => handleViewModeChange('text', 'palette') },
    { id: 'view-tree', label: 'View: Tree Explorer', icon: Network, action: () => handleViewModeChange('tree', 'palette'), disabled: !hasContent || !!state.error },
    { id: 'view-graph', label: 'View: Graph Explorer', icon: Workflow, action: () => handleViewModeChange('graph', 'palette'), disabled: !hasContent || !!state.error },
    {
      id: 'view-split-toggle',
      label: state.splitView ? 'View: Disable Split' : 'View: Split with Raw Editor',
      icon: Columns,
      action: () => handleSplitViewChange(!state.splitView, 'palette'),
      disabled: state.viewMode === 'text' || !hasContent || !!state.error,
    },
    {
      id: 'theme',
      label: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      icon: theme === 'dark' ? Sun : Moon,
      action: handleToggleTheme,
    },
    { id: 'copy', label: 'Copy JSON to Clipboard', icon: Copy, action: handleCopyRaw, disabled: !hasContent },
    { id: 'download', label: 'Download as .json', icon: Download, action: handleDownload, disabled: !hasContent },
    { id: 'clear', label: 'Clear Editor', icon: Trash2, action: handleClear, disabled: !hasContent },
    {
      id: 'sidebar',
      label: sidebarCollapsed ? 'Show Snapshots Sidebar' : 'Hide Snapshots Sidebar',
      shortcut: `${modKey}B`,
      icon: sidebarCollapsed ? PanelLeftOpen : PanelLeftClose,
      action: () => {
        track('sidebar_toggle', { collapsed: !sidebarCollapsed, source: 'palette' });
        setSidebarOverride(!sidebarCollapsed);
      },
    },
    { id: 'sample', label: 'Load Sample JSON', icon: FileJson, action: () => handleLoadSample() },
  ];

  return (
    <FileDropZone onFile={(content, fileName) => handleFileLoad(content, fileName, 'drop')}>
      <div className="app-container">
        <header className="top-nav">
          <div className="brand-title">
            <button
              type="button"
              className="button-tertiary button-icon-only"
              onClick={() => {
                track('sidebar_toggle', { collapsed: !sidebarCollapsed, source: 'toolbar' });
                setSidebarOverride(!sidebarCollapsed);
              }}
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
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
              onClick={() => handleOpenModal('palette', 'toolbar')}
              title={`Command palette (${modKey}K)`}
            >
              <CommandIcon size={14} />
              <span>Commands</span>
              <kbd className="toolbar-kbd">{modKey}K</kbd>
            </button>

            <button
              type="button"
              className="button-tertiary button-icon-only"
              onClick={(e) => handleToggleTheme(e)}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
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
              onClick={() => setSidebarOverride(true)}
              aria-hidden="true"
            />
          )}
          <SnapshotsPanel
            raw={state.raw}
            onLoad={(content) =>
              confirmReplace(content, () => {
                track('snapshot_load', { size_bucket: sizeBucket(content.length) });
                editor.loadContent(content);
              })
            }
            collapsed={sidebarCollapsed}
          />

          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Toolbar
              indent={state.indent}
              error={state.error}
              hasContent={!!state.raw.trim()}
              viewMode={state.viewMode}
              splitView={state.splitView}
              onIndentChange={(next) => {
                track('indent_change', { indent: String(next) });
                editor.setIndent(next);
              }}
              onFormat={() => runAction('format', 'toolbar')}
              onMinify={() => runAction('minify', 'toolbar')}
              onSortKeys={() => runAction('sort_keys', 'toolbar')}
              onRepair={() => runAction('repair', 'toolbar')}
              onViewModeChange={(mode) => handleViewModeChange(mode, 'toolbar')}
              onSplitViewChange={(split) => handleSplitViewChange(split, 'toolbar')}
              onFileUpload={(content, fileName) => handleFileLoad(content, fileName, 'upload')}
              onLoadSample={handleLoadSample}
              onOpenConvert={() => handleOpenModal('convert', 'toolbar')}
              onOpenImport={() => handleOpenModal('import', 'toolbar')}
              onOpenCompare={() => handleOpenModal('compare', 'toolbar')}
            />

            <ErrorBanner error={state.error} />

            <div className={`app-panes ${isSplit ? 'split' : state.viewMode}`}>
              {state.viewMode === 'text' || isSplit ? (
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

              {state.viewMode === 'tree' ? (
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
                  {hydrated ? (
                    <Suspense
                      fallback={
                        <div className="suspense-fallback">
                          <div className="suspense-spinner" />
                        </div>
                      }
                    >
                      <GraphView parsed={state.parsed} error={state.error} />
                    </Suspense>
                  ) : (
                    // The /graph-viewer route seeds viewMode to 'graph', but
                    // GraphView is React.lazy and renderToString can't await a
                    // chunk (React #419). Render a placeholder during SSR and
                    // the hydration render; the real graph mounts right after.
                    <div className="suspense-fallback">
                      <div className="suspense-spinner" />
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </main>
        </div>

        <section className="tool-intro" aria-label="About this tool">
          <h1>{route.h1}</h1>
          <p>{route.intro}</p>
        </section>

        <SiteFooter />

        <Suspense
          fallback={
            <div className="overlay-loading-backdrop">
              <div className="suspense-spinner" />
            </div>
          }
        >
          {showConvert ? (
            <ConvertModal
              raw={state.raw}
              parsed={state.parsed}
              initialFormat={convertManual ? undefined : route.convertTo}
              onClose={() => { setConvertManual(false); setAutoModalClosed(true); }}
            />
          ) : null}

          {showCompare ? (
            <CompareModal
              raw={state.raw}
              parsed={state.parsed}
              error={state.error}
              onClose={() => { setCompareManual(false); setAutoModalClosed(true); }}
            />
          ) : null}

          {showImport ? (
            <ImportModal
              indent={state.indent}
              initialFormat={importManual ? undefined : route.importFrom}
              onLoad={(json) =>
                confirmReplace(json, () => {
                  editor.loadContent(json);
                  setImportManual(false);
                  setAutoModalClosed(true);
                })
              }
              onClose={() => { setImportManual(false); setAutoModalClosed(true); }}
            />
          ) : null}

          {pendingReplace ? (
            <ConfirmDialog
              title={pendingReplace.kind === 'clear' ? 'Clear the editor?' : 'Replace the current JSON?'}
              message={
                pendingReplace.kind === 'clear'
                  ? 'This deletes everything in the editor. Save a snapshot first if you want to keep it.'
                  : 'This replaces everything in the editor. Save a snapshot first if you want to keep it.'
              }
              confirmLabel={pendingReplace.kind === 'clear' ? 'Clear' : 'Replace'}
              onConfirm={() => {
                pendingReplace.apply();
                setPendingReplace(null);
              }}
              onCancel={() => setPendingReplace(null)}
            />
          ) : null}

          {showPalette ? <CommandPalette commands={commands} onClose={() => setShowPalette(false)} /> : null}
        </Suspense>
      </div>
    </FileDropZone>
  );
}

export default App;
