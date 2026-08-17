import { useState } from 'react';
import { ChevronRight, Copy, ExternalLink, Check } from 'lucide-react';
import { isHexColor } from '../lib/color';
import type { FlatRow } from '../lib/flattenTree';
import { sizeBucket, track } from '../lib/analytics';
import './TreeNode.css';

function isUrl(str: string): boolean {
  return typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'));
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

interface TreeRowProps {
  row: FlatRow;
  filter: string;
  onToggle: (path: string) => void;
}

export function TreeRow({ row, filter, onToggle }: TreeRowProps) {
  const [copiedField, setCopiedField] = useState<'path' | 'val' | null>(null);
  const indent = { paddingLeft: `${row.depth * 16 + 6}px` };

  if (row.kind === 'close') {
    return (
      <div className="tree-row" style={indent}>
        <span className="tree-bracket">{row.closeBracket}</span>
      </div>
    );
  }

  const { path, keyName, value, type, isExpandable, collapsed } = row;

  async function handleCopyPath(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(path);
    // Depth, not the path string — a JSONPath is derived from the user's keys.
    track('tree_copy_path', { path_depth: path.split(/[.[]/).length - 1 });
    setCopiedField('path');
    setTimeout(() => setCopiedField(null), 1200);
  }

  async function handleCopyVal(e: React.MouseEvent) {
    e.stopPropagation();
    const valString = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    await navigator.clipboard.writeText(valString);
    track('tree_copy_value', { size_bucket: sizeBucket(valString.length) });
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
            title={`Copy JSONPath: ${path}`}
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

  const entryCount = Array.isArray(value) ? value.length : Object.keys(value as object).length;
  const openBracket = type === 'array' ? '[' : '{';
  const closeBracket = type === 'array' ? ']' : '}';
  const summary = `${entryCount} ${type === 'array' ? 'items' : 'keys'}`;

  return (
    <div
      role="button"
      tabIndex={0}
      className="tree-row tree-toggle"
      style={indent}
      onClick={() => onToggle(path)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(path);
        }
      }}
      aria-expanded={!collapsed}
      aria-label={keyName !== undefined ? `${keyName}: ${type} with ${summary}` : `${type} with ${summary}`}
    >
      <span className={`tree-chevron${!collapsed ? ' open' : ''}`}>
        <ChevronRight size={12} />
      </span>
      {keyName !== undefined ? (
        <span className="tree-key">
          <HighlightText text={keyName} filter={filter} />:
        </span>
      ) : null}
      <span className="tree-bracket">{openBracket}</span>
      {collapsed ? (
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
          title={`Copy JSONPath: ${path}`}
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
  );
}
