// All persistence for the app. Pure localStorage — no backend, no accounts.
import { nanoid } from 'nanoid';

const CURRENT_DOC_KEY = 'jsonfmt:current-doc';
const SNAPSHOTS_KEY = 'jsonfmt:snapshots';
const MAX_SNAPSHOTS = 50;

export interface Snapshot {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

export function saveCurrentDoc(content: string): void {
  try {
    localStorage.setItem(CURRENT_DOC_KEY, content);
  } catch {
    // localStorage can throw (quota exceeded, private browsing) — not critical, fail silently
  }
}

export function loadCurrentDoc(): string | null {
  try {
    return localStorage.getItem(CURRENT_DOC_KEY);
  } catch {
    return null;
  }
}

export function listSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Snapshot[];
  } catch {
    return [];
  }
}

export function saveSnapshot(name: string, content: string): Snapshot {
  const snapshot: Snapshot = { id: nanoid(8), name, content, createdAt: Date.now() };
  const next = [snapshot, ...listSnapshots()].slice(0, MAX_SNAPSHOTS);
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next));
  } catch {
    // quota exceeded — snapshot just won't persist, editor state is unaffected
  }
  return snapshot;
}

export function deleteSnapshot(id: string): void {
  const next = listSnapshots().filter((s) => s.id !== id);
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
}
