import { useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AlertCircle, ChevronRight, Check, Copy, FileJson, Maximize2, Minimize2, Zap, ZapOff } from 'lucide-react';
import type { ParseError } from '../lib/jsonParser';
import { isHexColor } from '../lib/color';
import './TreeNode.css';
import './GraphView.css';

interface GraphViewProps {
  parsed: unknown;
  error: ParseError | null;
  /** Changes only when a new document is loaded, not on edits. */
  docId: number;
}

type JsonType = 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean';

function typeOf(value: unknown): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonType;
}

function isContainerType(type: JsonType): type is 'object' | 'array' {
  return type === 'object' || type === 'array';
}

// Drawing every node of a large document froze the tab. A 15k-item array
// meant 765k DOM elements and a 10s mount. These caps keep the graph to a
// size a person can read anyway.
/** Rows a card shows before its "Show more" button. */
const ROW_PAGE = 100;
/** Cards drawn in total, however much is expanded. */
const MAX_CARDS = 300;
/** First-level children opened by default when a document loads. */
const INITIAL_EXPAND = 20;

interface CardEntry {
  key: string;
  value: unknown;
  type: JsonType;
  childPath?: string;
}

interface CardNode {
  path: string;
  keyName?: string;
  depth: number;
  type: 'object' | 'array';
  entries: CardEntry[];
  /** Entries past this card's row limit, not rendered. */
  hiddenRows: number;
  originRowId?: string;
}

interface CardBudget {
  left: number;
  truncated: boolean;
}

function collectNodes(
  value: unknown,
  path: string,
  depth: number,
  keyName: string | undefined,
  originRowId: string | undefined,
  expanded: Set<string>,
  rowLimits: Map<string, number>,
  budget: CardBudget,
  columns: CardNode[][],
) {
  const type = typeOf(value);
  if (!isContainerType(type)) return;
  if (budget.left <= 0) {
    budget.truncated = true;
    return;
  }
  budget.left--;

  const isArr = type === 'array';
  const limit = rowLimits.get(path) ?? ROW_PAGE;
  const total = isArr ? (value as unknown[]).length : Object.keys(value as object).length;
  const rawEntries = isArr
    ? (value as unknown[]).slice(0, limit).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>).slice(0, limit);

  const entries: CardEntry[] = rawEntries.map(([key, v]) => {
    const t = typeOf(v);
    const childPath = isContainerType(t) ? (isArr ? `${path}[${key}]` : `${path}.${key}`) : undefined;
    return { key, value: v, type: t, childPath };
  });

  const node: CardNode = { path, keyName, depth, type, entries, hiddenRows: total - entries.length, originRowId };
  if (!columns[depth]) columns[depth] = [];
  columns[depth].push(node);

  for (const entry of entries) {
    if (entry.childPath && expanded.has(entry.childPath)) {
      collectNodes(entry.value, entry.childPath, depth + 1, entry.key, `${path}::${entry.key}`, expanded, rowLimits, budget, columns);
    }
  }
}

function collectFirstLevelPaths(value: unknown, path: string): Set<string> {
  const acc = new Set<string>();
  const type = typeOf(value);
  if (!isContainerType(type)) return acc;
  const isArr = type === 'array';
  const entries = isArr
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  for (const [key, v] of entries) {
    if (acc.size >= INITIAL_EXPAND) break;
    if (isContainerType(typeOf(v))) {
      acc.add(isArr ? `${path}[${key}]` : `${path}.${key}`);
    }
  }
  return acc;
}

function collectAllContainerPaths(value: unknown, path: string, acc: Set<string>) {
  const type = typeOf(value);
  if (!isContainerType(type)) return;
  acc.add(path);
  const isArr = type === 'array';
  const entries = isArr
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  for (const [key, v] of entries) {
    const childPath = isArr ? `${path}[${key}]` : `${path}.${key}`;
    collectAllContainerPaths(v, childPath, acc);
  }
}

interface Edge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
}

const CARD_HEADER_HEIGHT = 30;

function GraphValue({ type, value }: { type: JsonType; value: unknown }) {
  if (type === 'string') {
    return (
      <span className="tree-value tree-string" title={value as string}>
        {isHexColor(value) ? <span className="color-swatch" style={{ background: value }} /> : null}
        "{value as string}"
      </span>
    );
  }
  return (
    <span className={`tree-value tree-${type}`} title={String(value)}>
      {String(value)}
    </span>
  );
}

function GraphCard({
  node,
  isExpanded,
  onToggleRow,
  onShowMore,
  registerCardRef,
  registerRowRef,
}: {
  node: CardNode;
  isExpanded: (path: string) => boolean;
  onToggleRow: (path: string) => void;
  onShowMore: (path: string) => void;
  registerCardRef: (path: string, el: HTMLDivElement | null) => void;
  registerRowRef: (id: string, el: HTMLElement | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  const openBracket = node.type === 'array' ? '[' : '{';
  const closeBracket = node.type === 'array' ? ']' : '}';
  const summary = `${node.entries.length + node.hiddenRows} ${node.type === 'array' ? 'items' : 'keys'}`;

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(node.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="graph-card" ref={(el) => registerCardRef(node.path, el)}>
      <div className="graph-card-header">
        {node.keyName !== undefined ? <span className="tree-key">{node.keyName}</span> : null}
        <span className="tree-bracket">{openBracket}</span>
        <span className="tree-summary">{summary}</span>
        <span className="tree-bracket">{closeBracket}</span>
        <button
          type="button"
          className="button-tertiary button-icon-only graph-card-copy"
          onClick={handleCopy}
          title={`Copy JSONPath: ${node.path}`}
          aria-label={`Copy JSONPath: ${node.path}`}
        >
          {copied ? <Check size={11} style={{ color: 'var(--semantic-success)' }} /> : <Copy size={11} />}
        </button>
      </div>

      {node.entries.length > 0 ? (
        <div className="graph-card-body">
          {node.entries.map((entry) => {
            const isContainer = !!entry.childPath;
            if (!isContainer) {
              return (
                <div className="graph-row" key={entry.key}>
                  <span className="tree-key">{entry.key}:</span>
                  <GraphValue type={entry.type} value={entry.value} />
                </div>
              );
            }

            const expanded = isExpanded(entry.childPath!);
            const rowId = `${node.path}::${entry.key}`;
            return (
              <button
                type="button"
                key={entry.key}
                className={`graph-row graph-row-toggle${expanded ? ' active' : ''}`}
                onClick={() => onToggleRow(entry.childPath!)}
                ref={(el) => registerRowRef(rowId, el)}
                aria-expanded={expanded}
              >
                <span className="tree-key">{entry.key}:</span>
                <span className="tree-bracket">{entry.type === 'array' ? '[' : '{'}</span>
                <span className="tree-summary">
                  {Array.isArray(entry.value) ? entry.value.length : Object.keys(entry.value as object).length}{' '}
                  {entry.type === 'array' ? 'items' : 'keys'}
                </span>
                <span className="tree-bracket">{entry.type === 'array' ? ']' : '}'}</span>
                <span className="graph-row-connector">
                  <ChevronRight size={12} />
                </span>
              </button>
            );
          })}
          {node.hiddenRows > 0 ? (
            <button
              type="button"
              className="graph-row graph-row-toggle graph-show-more"
              onClick={() => onShowMore(node.path)}
            >
              Show {Math.min(ROW_PAGE, node.hiddenRows)} more of {node.hiddenRows.toLocaleString()}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="graph-card-body graph-card-empty">empty {node.type}</div>
      )}
    </div>
  );
}

interface GraphCanvasProps {
  parsed: unknown;
  /** Open cards by path, or null for the default first-level view. */
  expanded: Set<string> | null;
  setExpanded: Dispatch<SetStateAction<Set<string> | null>>;
  rowLimits: Map<string, number>;
  setRowLimits: Dispatch<SetStateAction<Map<string, number>>>;
}

function GraphCanvas({ parsed, expanded, setExpanded, rowLimits, setRowLimits }: GraphCanvasProps) {
  // "Live Transform": while on, the canvas tracks `parsed` directly. While off,
  // the canvas keeps rendering the last-synced snapshot so edits to a large
  // document don't force a full graph relayout on every keystroke.
  const [live, setLive] = useState(true);
  const [displayParsed, setDisplayParsed] = useState(parsed);
  const stale = displayParsed !== parsed;
  if (live && stale) {
    setDisplayParsed(parsed);
  }

  const openPaths = useMemo(
    () => expanded ?? collectFirstLevelPaths(displayParsed, '$'),
    [expanded, displayParsed]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const [edges, setEdges] = useState<Edge[]>([]);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  const { columns, truncated } = useMemo(() => {
    const cols: CardNode[][] = [];
    const budget: CardBudget = { left: MAX_CARDS, truncated: false };
    collectNodes(displayParsed, '$', 0, undefined, undefined, openPaths, rowLimits, budget, cols);
    return { columns: cols, truncated: budget.truncated };
  }, [displayParsed, openPaths, rowLimits]);

  const flatNodes = useMemo(() => columns.flat(), [columns]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    function recompute() {
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const nextEdges: Edge[] = [];

      for (const node of flatNodes) {
        if (!node.originRowId) continue;
        const rowEl = rowRefs.current.get(node.originRowId);
        const cardEl = cardRefs.current.get(node.path);
        if (!rowEl || !cardEl) continue;

        const rowRect = rowEl.getBoundingClientRect();
        const cardRect = cardEl.getBoundingClientRect();
        // A long card scrolls its own body. Pin edges from rows scrolled out
        // of view to the body's visible edge so they don't trail off.
        const bodyRect = rowEl.parentElement?.getBoundingClientRect();
        let rowY = rowRect.top + rowRect.height / 2;
        if (bodyRect) rowY = Math.min(Math.max(rowY, bodyRect.top), bodyRect.bottom);

        nextEdges.push({
          id: node.path,
          x1: rowRect.right - containerRect.left + container.scrollLeft,
          y1: rowY - containerRect.top + container.scrollTop,
          x2: cardRect.left - containerRect.left + container.scrollLeft,
          y2: cardRect.top + CARD_HEADER_HEIGHT / 2 - containerRect.top + container.scrollTop,
          label: node.keyName,
        });
      }

      setEdges(nextEdges);
      setSvgSize({ width: container.scrollWidth, height: container.scrollHeight });
    }

    // Card bodies scroll on their own. Scroll events don't bubble, so a
    // capture listener catches them, batched to one recompute per frame.
    let frame = 0;
    function onCardScroll(e: Event) {
      if (e.target === container) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    }

    recompute();
    window.addEventListener('resize', recompute);
    container.addEventListener('scroll', onCardScroll, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', recompute);
      container.removeEventListener('scroll', onCardScroll, true);
    };
  }, [flatNodes]);

  function toggleRow(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev ?? openPaths);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function showMore(path: string) {
    setRowLimits((prev) => new Map(prev).set(path, (prev.get(path) ?? ROW_PAGE) + ROW_PAGE));
  }

  function expandAll() {
    const all = new Set<string>();
    collectAllContainerPaths(displayParsed, '$', all);
    setExpanded(all);
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function toggleLive() {
    setLive((v) => !v);
  }

  return (
    <div className="graph-view-container">
      <div className="graph-toolbar">
        <button type="button" className="button-tertiary" onClick={expandAll} title="Expand every node">
          <Maximize2 size={12} />
          <span>Expand All</span>
        </button>
        <button type="button" className="button-tertiary" onClick={collapseAll} title="Collapse every node">
          <Minimize2 size={12} />
          <span>Collapse All</span>
        </button>

        {truncated ? (
          <span className="graph-truncated" role="status">
            Showing the first {MAX_CARDS} cards. Collapse some to see more.
          </span>
        ) : null}

        <button
          type="button"
          className={`button-tertiary graph-live-toggle${live ? ' active' : ''}`}
          onClick={toggleLive}
          title={
            live
              ? 'Live Transform on: the graph re-renders on every edit. Turn off to pause updates for large documents.'
              : 'Live Transform paused: the graph is frozen. Click to resume and sync with the latest document.'
          }
        >
          {live ? <Zap size={12} /> : <ZapOff size={12} />}
          <span>Live Transform</span>
          {!live && stale ? <span className="graph-live-stale-dot" /> : null}
        </button>
      </div>

      <div className="graph-canvas" ref={scrollRef}>
        <svg
          className="graph-edges"
          width={svgSize.width}
          height={svgSize.height}
          style={{ width: svgSize.width, height: svgSize.height }}
        >
          {edges.map((edge) => {
            const midX = (edge.x1 + edge.x2) / 2;
            const midY = (edge.y1 + edge.y2) / 2;
            const labelWidth = edge.label ? edge.label.length * 6.2 + 10 : 0;
            return (
              <g key={edge.id}>
                <path
                  d={`M ${edge.x1} ${edge.y1} C ${midX} ${edge.y1}, ${midX} ${edge.y2}, ${edge.x2} ${edge.y2}`}
                  stroke="var(--hairline-strong)"
                  strokeWidth={1.5}
                  fill="none"
                />
                {edge.label ? (
                  <>
                    <rect
                      className="graph-edge-label-bg"
                      x={midX - labelWidth / 2}
                      y={midY - 8}
                      width={labelWidth}
                      height={16}
                      rx={3}
                    />
                    <text
                      className="graph-edge-label-text"
                      x={midX}
                      y={midY}
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {edge.label}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}
        </svg>

        <div className="graph-columns">
          {columns.map((col, i) => (
            <div className="graph-column" key={i}>
              {col.map((node) => (
                <GraphCard
                  key={node.path}
                  node={node}
                  isExpanded={(path) => openPaths.has(path)}
                  onToggleRow={toggleRow}
                  onShowMore={showMore}
                  registerCardRef={(path, el) => {
                    if (el) cardRefs.current.set(path, el);
                    else cardRefs.current.delete(path);
                  }}
                  registerRowRef={(id, el) => {
                    if (el) rowRefs.current.set(id, el);
                    else rowRefs.current.delete(id);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GraphView({ parsed, error, docId }: GraphViewProps) {
  // Open cards live here rather than in GraphCanvas, which unmounts whenever
  // a half-typed edit makes the JSON invalid. Edits keep what the user
  // opened. Only loading a different document resets it, like the tree does.
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const [rowLimits, setRowLimits] = useState<Map<string, number>>(() => new Map());
  const [trackedDocId, setTrackedDocId] = useState(docId);
  if (trackedDocId !== docId) {
    setTrackedDocId(docId);
    setExpanded(null);
    setRowLimits(new Map());
  }

  if (error) {
    return (
      <div className="tree-empty">
        <div className="tree-empty-icon" style={{ borderColor: 'rgba(248, 81, 73, 0.3)', color: 'var(--danger)' }}>
          <AlertCircle size={22} />
        </div>
        <span style={{ fontWeight: 500, color: 'var(--ink)' }}>Syntax Error</span>
        <span style={{ color: 'var(--ink-subtle)', maxWidth: '280px', fontSize: '11px' }}>
          Fix the JSON syntax error in the editor to explore the object graph.
        </span>
      </div>
    );
  }

  if (parsed === undefined) {
    return (
      <div className="tree-empty">
        <div className="tree-empty-icon">
          <FileJson size={22} />
        </div>
        <span style={{ fontWeight: 500, color: 'var(--ink)' }}>No JSON Loaded</span>
        <span style={{ color: 'var(--ink-subtle)', maxWidth: '280px', fontSize: '11px' }}>
          Paste or upload JSON data to explore it as a graph.
        </span>
      </div>
    );
  }

  if (!isContainerType(typeOf(parsed))) {
    return (
      <div className="tree-empty">
        <div className="tree-empty-icon">
          <FileJson size={22} />
        </div>
        <span style={{ fontWeight: 500, color: 'var(--ink)' }}>Scalar Value</span>
        <span style={{ color: 'var(--ink-subtle)', maxWidth: '280px', fontSize: '11px' }}>
          The graph view needs an object or array at the root. This document is a single value:{' '}
          <strong style={{ color: 'var(--ink)' }}>{JSON.stringify(parsed)}</strong>
        </span>
      </div>
    );
  }

  return (
    <GraphCanvas
      parsed={parsed}
      expanded={expanded}
      setExpanded={setExpanded}
      rowLimits={rowLimits}
      setRowLimits={setRowLimits}
    />
  );
}
