import { useState, useMemo } from 'react';
import { ChevronRight, Copy, ExternalLink, Check } from 'lucide-react';
import { isHexColor } from '../lib/color';
import './TreeNode.css';

interface TreeNodeProps {
  keyName?: string;
  value: unknown;
  depth: number;
  parentPath?: string;
  parentIsArray?: boolean;
  filter?: string;
}

type JsonType = 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean';

function typeOf(value: unknown): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonType;
}

function isUrl(str: string): boolean {
  return typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'));
}

/**
 * Recursively check whether a node (or any of its descendants) matches the
 * filter string. Matching is case-insensitive against keys AND primitive values.
 */
function nodeMatches(key: string | undefined, value: unknown, filter: string): boolean {
  if (!filter) return true;
  const lower = filter.toLowerCase();

  // Check the key name
  if (key !== undefined && key.toLowerCase().includes(lower)) return true;

  const type = typeOf(value);

  // For primitives, check the value
  if (type !== 'object' && type !== 'array') {
    return String(value).toLowerCase().includes(lower);
  }

  // For containers, check children recursively
  const entries = Array.isArray(value)
    ? value.map((item, i) => [String(i), item] as const)
    : Object.entries(value as Record<string, unknown>);

  return entries.some(([k, v]) => nodeMatches(k, v, filter));
}

function HighlightText({ text, filter }: { text: string; filter?: string }) {
  if (!filter) return <>{text}</>;
  const index = text.toLowerCase().indexOf(filter.toLowerCase());
  if (index === -1) return <>{text}</>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + filter.length);
  const after = text.slice(index + filter.length);

  return (
    <>
      {before}
      <mark className="tree-highlight">{match}</mark>
      {after}
    </>
  );
}

export function TreeNode({ keyName, value, depth, parentPath = '$', parentIsArray = false, filter = '' }: TreeNodeProps) {
  const [collapsed, setCollapsed] = useState(depth > 2);
  const [copiedField, setCopiedField] = useState<'path' | 'val' | null>(null);

  const type = typeOf(value);
  const isExpandable = type === 'object' || type === 'array';
  const indent = { paddingLeft: `${depth * 16 + 6}px` };

  const currentPath = keyName !== undefined
    ? (parentIsArray ? `${parentPath}[${keyName}]` : `${parentPath}.${keyName}`)
    : parentPath;

  // Memoize filter match so we don't re-walk on every render
  const matches = useMemo(
    () => nodeMatches(keyName, value, filter),
    [keyName, value, filter],
  );

  // If a filter is active and this entire subtree doesn't match, hide it
  if (filter && !matches) {
    return null;
  }

  async function handleCopyPath(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(currentPath);
    setCopiedField('path');
    setTimeout(() => setCopiedField(null), 1200);
  }

  async function handleCopyVal(e: React.MouseEvent) {
    e.stopPropagation();
    const valString = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    await navigator.clipboard.writeText(valString);
    setCopiedField('val');
    setTimeout(() => setCopiedField(null), 1200);
  }

  if (!isExpandable) {
    const isStringUrl = type === 'string' && isUrl(value as string);

    return (
      <div className="tree-row" style={indent}>
        {keyName !== undefined ? (
          <span className="tree-key">
            <HighlightText text={keyName} filter={filter} />:
          </span>
        ) : null}
        {isStringUrl ? (
          <a
            href={value as string}
            target="_blank"
            rel="noopener noreferrer"
            className="tree-url-link"
            title="Open link in new tab"
          >
            <span>
              "<HighlightText text={value as string} filter={filter} />"
            </span>
            <ExternalLink size={11} />
          </a>
        ) : (
          <span className={`tree-value tree-${type}`}>
            {type === 'string' ? (
              <>
                {isHexColor(value) ? <span className="color-swatch" style={{ background: value as string }} /> : null}
                "<HighlightText text={value as string} filter={filter} />"
              </>
            ) : (
              <HighlightText text={String(value)} filter={filter} />
            )}
          </span>
        )}

        <div className="tree-hover-actions">
          <button
            type="button"
            className="button-tertiary button-icon-only tree-action-btn"
            onClick={handleCopyPath}
            title={`Copy JSONPath: ${currentPath}`}
            aria-label="Copy JSONPath"
          >
            {copiedField === 'path' ? (
              <Check size={11} style={{ color: 'var(--semantic-success)' }} />
            ) : (
              <span className="path-badge">path</span>
            )}
          </button>
          <button
            type="button"
            className="button-tertiary button-icon-only tree-action-btn"
            onClick={handleCopyVal}
            title="Copy value"
            aria-label="Copy value"
          >
            {copiedField === 'val' ? (
              <Check size={11} style={{ color: 'var(--semantic-success)' }} />
            ) : (
              <Copy size={11} />
            )}
          </button>
        </div>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((item, i) => [String(i), item] as const)
    : Object.entries(value as Record<string, unknown>);

  const openBracket = type === 'array' ? '[' : '{';
  const closeBracket = type === 'array' ? ']' : '}';
  const summary = `${entries.length} ${type === 'array' ? 'items' : 'keys'}`;

  // When filter is active, auto-expand containers so matched children are visible
  const effectiveCollapsed = filter ? false : collapsed;

  return (
    <div className="tree-branch">
      <div
        role="button"
        tabIndex={0}
        className="tree-row tree-toggle"
        style={indent}
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
        aria-expanded={!effectiveCollapsed}
        aria-label={keyName !== undefined ? `${keyName}: ${type} with ${summary}` : `${type} with ${summary}`}
      >
        <span className={`tree-chevron${!effectiveCollapsed ? ' open' : ''}`}>
          <ChevronRight size={12} />
        </span>
        {keyName !== undefined ? (
          <span className="tree-key">
            <HighlightText text={keyName} filter={filter} />:
          </span>
        ) : null}
        <span className="tree-bracket">{openBracket}</span>
        {effectiveCollapsed ? (
          <>
            <span className="tree-summary">{summary}</span>
            <span className="tree-bracket">{closeBracket}</span>
          </>
        ) : null}

        <div className="tree-hover-actions">
          <button
            type="button"
            className="button-tertiary button-icon-only tree-action-btn"
            onClick={handleCopyPath}
            title={`Copy JSONPath: ${currentPath}`}
            aria-label="Copy JSONPath"
          >
            {copiedField === 'path' ? (
              <Check size={11} style={{ color: 'var(--semantic-success)' }} />
            ) : (
              <span className="path-badge">path</span>
            )}
          </button>
          <button
            type="button"
            className="button-tertiary button-icon-only tree-action-btn"
            onClick={handleCopyVal}
            title="Copy object JSON"
            aria-label="Copy value"
          >
            {copiedField === 'val' ? (
              <Check size={11} style={{ color: 'var(--semantic-success)' }} />
            ) : (
              <Copy size={11} />
            )}
          </button>
        </div>
      </div>

      {!effectiveCollapsed ? (
        <div className="tree-children">
          {entries.map(([k, v]) => (
            <TreeNode
              key={k}
              keyName={k}
              value={v}
              depth={depth + 1}
              parentPath={currentPath}
              parentIsArray={type === 'array'}
              filter={filter}
            />
          ))}
          <div className="tree-row" style={indent}>
            <span className="tree-bracket">{closeBracket}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
