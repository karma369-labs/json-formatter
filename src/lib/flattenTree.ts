export type JsonType = 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean';

export function typeOf(value: unknown): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonType;
}

/** Containers deeper than this collapse by default, matching the old per-node TreeNode behavior. */
export function isDefaultCollapsed(depth: number): boolean {
  return depth > 2;
}

/** Case-insensitive match against a node's key or, recursively, any descendant key/value. */
export function nodeMatches(key: string | undefined, value: unknown, filter: string): boolean {
  if (!filter) return true;
  const lower = filter.toLowerCase();

  if (key !== undefined && key.toLowerCase().includes(lower)) return true;

  const type = typeOf(value);
  if (type !== 'object' && type !== 'array') {
    return String(value).toLowerCase().includes(lower);
  }

  const entries = Array.isArray(value)
    ? value.map((item, i) => [String(i), item] as const)
    : Object.entries(value as Record<string, unknown>);

  return entries.some(([k, v]) => nodeMatches(k, v, filter));
}

export interface FlatNodeRow {
  kind: 'node';
  path: string;
  keyName?: string;
  value: unknown;
  depth: number;
  type: JsonType;
  isExpandable: boolean;
  collapsed: boolean;
}

export interface FlatCloseRow {
  kind: 'close';
  path: string;
  depth: number;
  closeBracket: string;
}

export type FlatRow = FlatNodeRow | FlatCloseRow;

/**
 * Flattens the JSON tree into a list of visible rows given the current
 * search filter and the set of paths whose collapse state was manually
 * toggled away from the depth-based default. Powers the virtualized TreeView
 * — rendering a flat list of rows is what makes windowing possible.
 */
export function flattenTree(value: unknown, filter: string, toggled: Set<string>): FlatRow[] {
  const rows: FlatRow[] = [];
  walk(value, undefined, '$', 0, filter, toggled, rows);
  return rows;
}

function walk(
  value: unknown,
  keyName: string | undefined,
  path: string,
  depth: number,
  filter: string,
  toggled: Set<string>,
  rows: FlatRow[]
) {
  if (filter && !nodeMatches(keyName, value, filter)) return;

  const type = typeOf(value);
  const isExpandable = type === 'object' || type === 'array';

  if (!isExpandable) {
    rows.push({ kind: 'node', path, keyName, value, depth, type, isExpandable: false, collapsed: false });
    return;
  }

  const isArray = type === 'array';
  const defaultCollapsed = isDefaultCollapsed(depth);
  const collapsed = filter ? false : toggled.has(path) ? !defaultCollapsed : defaultCollapsed;

  rows.push({ kind: 'node', path, keyName, value, depth, type, isExpandable: true, collapsed });

  if (!collapsed) {
    const entries = isArray
      ? (value as unknown[]).map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>);

    for (const [k, v] of entries) {
      const childPath = isArray ? `${path}[${k}]` : `${path}.${k}`;
      walk(v, k, childPath, depth + 1, filter, toggled, rows);
    }

    rows.push({ kind: 'close', path: `${path}::close`, depth, closeBracket: isArray ? ']' : '}' });
  }
}
