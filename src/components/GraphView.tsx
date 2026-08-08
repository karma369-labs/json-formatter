import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronRight, Check, Copy, FileJson, Maximize2, Minimize2 } from 'lucide-react';
import type { ParseError } from '../lib/jsonParser';
import './TreeNode.css';
import './GraphView.css';

interface GraphViewProps {
  parsed: unknown;
  error: ParseError | null;
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
  originRowId?: string;
}

function collectNodes(
  value: unknown,
  path: string,
  depth: number,
  keyName: string | undefined,
  originRowId: string | undefined,
  expanded: Set<string>,
  columns: CardNode[][],
) {
  const type = typeOf(value);
  if (!isContainerType(type)) return;

  const isArr = type === 'array';
  const rawEntries = isArr
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  const entries: CardEntry[] = rawEntries.map(([key, v]) => {
    const t = typeOf(v);
    const childPath = isContainerType(t) ? (isArr ? `${path}[${key}]` : `${path}.${key}`) : undefined;
    return { key, value: v, type: t, childPath };
  });

  const node: CardNode = { path, keyName, depth, type, entries, originRowId };
  if (!columns[depth]) columns[depth] = [];
  columns[depth].push(node);

  for (const entry of entries) {
    if (entry.childPath && expanded.has(entry.childPath)) {
      collectNodes(entry.value, entry.childPath, depth + 1, entry.key, `${path}::${entry.key}`, expanded, columns);
    }
  }
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
}

const CARD_HEADER_HEIGHT = 30;

function GraphValue({ type, value }: { type: JsonType; value: unknown }) {
  if (type === 'string') {
    return (
      <span className="tree-value tree-string" title={value as string}>
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
  registerCardRef,
  registerRowRef,
}: {
  node: CardNode;
  isExpanded: (path: string) => boolean;
  onToggleRow: (path: string) => void;
  registerCardRef: (path: string, el: HTMLDivElement | null) => void;
  registerRowRef: (id: string, el: HTMLDivElement | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  const openBracket = node.type === 'array' ? '[' : '{';
  const closeBracket = node.type === 'array' ? ']' : '}';
  const summary = `${node.entries.length} ${node.type === 'array' ? 'items' : 'keys'}`;

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
        </div>
      ) : (
        <div className="graph-card-body graph-card-empty">empty {node.type}</div>
      )}
    </div>
  );
}

function GraphCanvas({ parsed }: { parsed: unknown }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Reset expansion state whenever a structurally new document is loaded.
  const [trackedParsed, setTrackedParsed] = useState(parsed);
  if (trackedParsed !== parsed) {
    setTrackedParsed(parsed);
    if (expanded.size > 0) setExpanded(new Set());
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [edges, setEdges] = useState<Edge[]>([]);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  const columns = useMemo(() => {
    const cols: CardNode[][] = [];
    collectNodes(parsed, '$', 0, undefined, undefined, expanded, cols);
    return cols;
  }, [parsed, expanded]);

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

        nextEdges.push({
          id: node.path,
          x1: rowRect.right - containerRect.left + container.scrollLeft,
          y1: rowRect.top + rowRect.height / 2 - containerRect.top + container.scrollTop,
          x2: cardRect.left - containerRect.left + container.scrollLeft,
          y2: cardRect.top + CARD_HEADER_HEIGHT / 2 - containerRect.top + container.scrollTop,
        });
      }

      setEdges(nextEdges);
      setSvgSize({ width: container.scrollWidth, height: container.scrollHeight });
    }

    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [flatNodes]);

  function toggleRow(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function expandAll() {
    const all = new Set<string>();
    collectAllContainerPaths(parsed, '$', all);
    setExpanded(all);
  }

  function collapseAll() {
    setExpanded(new Set());
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
            return (
              <path
                key={edge.id}
                d={`M ${edge.x1} ${edge.y1} C ${midX} ${edge.y1}, ${midX} ${edge.y2}, ${edge.x2} ${edge.y2}`}
                stroke="var(--hairline-strong)"
                strokeWidth={1.5}
                fill="none"
              />
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
                  isExpanded={(path) => expanded.has(path)}
                  onToggleRow={toggleRow}
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

export function GraphView({ parsed, error }: GraphViewProps) {
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

  return <GraphCanvas parsed={parsed} />;
}
