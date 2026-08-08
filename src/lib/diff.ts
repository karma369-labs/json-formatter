// Pure structural JSON diff. Walks two parsed values and emits add/remove/change
// ops with JSONPath-style paths — no text diffing, no UI, no DOM.

export type DiffOpType = 'add' | 'remove' | 'change';

export interface DiffOp {
  type: DiffOpType;
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatKey(base: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`;
}

function diffValue(path: string, a: unknown, b: unknown, ops: DiffOp[]): void {
  if (a === b) return;

  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const childPath = `${path}[${i}]`;
      if (i >= a.length) ops.push({ type: 'add', path: childPath, newValue: b[i] });
      else if (i >= b.length) ops.push({ type: 'remove', path: childPath, oldValue: a[i] });
      else diffValue(childPath, a[i], b[i], ops);
    }
    return;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const childPath = formatKey(path, key);
      const hasA = Object.prototype.hasOwnProperty.call(a, key);
      const hasB = Object.prototype.hasOwnProperty.call(b, key);
      if (!hasA) ops.push({ type: 'add', path: childPath, newValue: b[key] });
      else if (!hasB) ops.push({ type: 'remove', path: childPath, oldValue: a[key] });
      else diffValue(childPath, a[key], b[key], ops);
    }
    return;
  }

  ops.push({ type: 'change', path, oldValue: a, newValue: b });
}

export function diffJson(a: unknown, b: unknown): DiffOp[] {
  const ops: DiffOp[] = [];
  diffValue('$', a, b, ops);
  return ops;
}

export function summarizeDiff(ops: DiffOp[]): DiffSummary {
  const summary: DiffSummary = { added: 0, removed: 0, changed: 0 };
  for (const op of ops) {
    if (op.type === 'add') summary.added++;
    else if (op.type === 'remove') summary.removed++;
    else summary.changed++;
  }
  return summary;
}

export function previewValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    const json = JSON.stringify(value);
    return json.length > 120 ? `${json.slice(0, 120)}…` : json;
  } catch {
    return String(value);
  }
}
