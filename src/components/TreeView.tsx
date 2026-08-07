import { useState, useMemo, type ChangeEvent } from 'react';
import { FileJson, AlertCircle, Search, X } from 'lucide-react';
import type { ParseError } from '../lib/jsonParser';
import { TreeNode } from './TreeNode';
import './TreeView.css';

interface TreeViewProps {
  parsed: unknown;
  error: ParseError | null;
}

function countMatches(val: unknown, filter: string): number {
  if (!filter) return 0;
  const lower = filter.toLowerCase();
  let count = 0;

  function walk(key: string | undefined, v: unknown) {
    let keyMatched = false;
    if (key !== undefined && key.toLowerCase().includes(lower)) {
      count++;
      keyMatched = true;
    }

    if (v === null || v === undefined) {
      if (!keyMatched && String(v).toLowerCase().includes(lower)) count++;
      return;
    }

    const isArr = Array.isArray(v);
    const isObj = typeof v === 'object';

    if (!isArr && !isObj) {
      if (!keyMatched && String(v).toLowerCase().includes(lower)) count++;
      return;
    }

    const entries = isArr
      ? (v as unknown[]).map((item, i) => [String(i), item] as const)
      : Object.entries(v as Record<string, unknown>);

    for (const [k, child] of entries) {
      walk(k, child);
    }
  }

  walk(undefined, val);
  return count;
}

export function TreeView({ parsed, error }: TreeViewProps) {
  const [filter, setFilter] = useState('');

  const matchCount = useMemo(() => {
    if (!filter.trim() || parsed === undefined || error) return 0;
    return countMatches(parsed, filter.trim());
  }, [parsed, filter, error]);

  if (error) {
    return (
      <div className="tree-empty">
        <div className="tree-empty-icon" style={{ borderColor: 'rgba(248, 81, 73, 0.3)', color: 'var(--danger)' }}>
          <AlertCircle size={22} />
        </div>
        <span style={{ fontWeight: 500, color: 'var(--ink)' }}>Syntax Error</span>
        <span style={{ color: 'var(--ink-subtle)', maxWidth: '280px', fontSize: '11px' }}>
          Fix the JSON syntax error in the editor to inspect the object tree.
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
          Paste or upload JSON data to explore nodes, types, and JSONPaths.
        </span>
      </div>
    );
  }

  return (
    <div className="tree-view-container">
      <div className="tree-search-bar">
        <Search size={13} style={{ color: 'var(--ink-subtle)' }} />
        <input
          type="text"
          className="tree-search-input"
          placeholder="Filter keys or values..."
          value={filter}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
        />
        {filter.trim() ? (
          <span className={`tree-match-badge${matchCount === 0 ? ' no-match' : ''}`}>
            {matchCount} {matchCount === 1 ? 'match' : 'matches'}
          </span>
        ) : null}
        {filter ? (
          <button
            type="button"
            className="button-tertiary button-icon-only"
            style={{ width: '20px', height: '20px' }}
            onClick={() => setFilter('')}
            title="Clear filter"
          >
            <X size={12} />
          </button>
        ) : null}
      </div>

      <div className="tree-view">
        <TreeNode value={parsed} depth={0} parentPath="$" filter={filter.trim()} />
      </div>
    </div>
  );
}
