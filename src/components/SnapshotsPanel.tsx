import { useMemo, useState, type ChangeEvent } from 'react';
import { Bookmark, Plus, Trash2, Copy, Check, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { deleteSnapshot, listSnapshots, saveSnapshot, type Snapshot } from '../lib/storage';
import { sizeBucket, track } from '../lib/analytics';
import { useHydrated } from '../hooks/useClientOnly';
import { ConfirmDialog } from './ConfirmDialog';
import './SnapshotsPanel.css';

interface SnapshotsPanelProps {
  raw: string;
  onLoad: (raw: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SnapshotsPanel({ raw, onLoad, collapsed = false, onToggleCollapse }: SnapshotsPanelProps) {
  // listSnapshots() reads localStorage, which doesn't exist during the
  // prerender — and a useState initializer runs again during hydration, so
  // seeding state with it would mismatch for anyone with saved snapshots.
  // Instead the stored list is only read once hydrated, and local edits
  // (save/delete) take over via `edited` from the first mutation onward.
  const hydrated = useHydrated();
  const stored = useMemo(() => (hydrated ? listSnapshots() : []), [hydrated]);
  const [edited, setEdited] = useState<Snapshot[] | null>(null);
  const snapshots = edited ?? stored;
  // Forwards the functional form through to setEdited rather than applying it
  // to this render's `snapshots`, so batched updates still compose correctly.
  const setSnapshots = (update: (prev: Snapshot[]) => Snapshot[]) =>
    setEdited((prev) => update(prev ?? stored));
  const [name, setName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Snapshot | null>(null);

  function handleSave() {
    const trimmed = name.trim();
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const label = trimmed || `Snapshot ${timeString}`;
    const snapshot = saveSnapshot(label, raw);
    setSnapshots((prev) => [snapshot, ...prev]);
    setName('');
    // Only whether a name was typed, never the name itself.
    track('snapshot_save', { named: !!trimmed, size_bucket: sizeBucket(raw.length) });
  }

  function handleDelete(id: string) {
    deleteSnapshot(id);
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
    track('snapshot_delete');
  }

  async function handleCopy(content: string, id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
    track('snapshot_copy', { size_bucket: sizeBucket(content.length) });
  }

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Bookmark size={13} />
          <span>Snapshots</span>
        </div>
        {onToggleCollapse ? (
          <button
            type="button"
            className="button-tertiary button-icon-only"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        ) : null}
      </div>

      <div className="sidebar-content">
        <div className="snapshot-add">
          <input
            type="text"
            className="snapshot-input"
            placeholder="Snapshot name..."
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && raw.trim()) handleSave();
            }}
          />
          <button
            type="button"
            className="button-secondary"
            onClick={handleSave}
            disabled={!raw.trim()}
          >
            <Plus size={13} />
            <span>Save</span>
          </button>
        </div>

        <ul className="snapshot-list">
          {snapshots.length === 0 ? (
            <li className="snapshot-empty">
              <Inbox size={22} style={{ opacity: 0.4 }} />
              <span>No snapshots saved</span>
            </li>
          ) : (
            snapshots.map((s) => {
              const isActive = raw.trim() !== '' && s.content.trim() === raw.trim();
              const lineCount = s.content ? s.content.split('\n').length : 0;
              const dateStr = new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

              return (
                <li
                  key={s.id}
                  className={`snapshot-card${isActive ? ' active' : ''}`}
                  onClick={() => onLoad(s.content)}
                  title="Click to load snapshot"
                >
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingRight: '8px' }}>
                      <span className="snapshot-title">{s.name}</span>
                      {isActive ? <span className="snapshot-active-badge">Loaded</span> : null}
                    </div>
                    <span className="snapshot-sub">{lineCount} lines · {dateStr}</span>
                  </div>
                  <div className="snapshot-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="button-tertiary button-icon-only snapshot-action-btn"
                      onClick={(e) => handleCopy(s.content, s.id, e)}
                      title="Copy snapshot content"
                      aria-label="Copy snapshot content"
                    >
                      {copiedId === s.id ? <Check size={12} style={{ color: 'var(--semantic-success)' }} /> : <Copy size={12} />}
                    </button>
                    <button
                      type="button"
                      className="button-tertiary button-icon-only snapshot-action-btn delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(s);
                      }}
                      title="Delete snapshot"
                      aria-label="Delete snapshot"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this snapshot?"
          message={`"${pendingDelete.name}" will be gone for good. This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            handleDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </aside>
  );
}
