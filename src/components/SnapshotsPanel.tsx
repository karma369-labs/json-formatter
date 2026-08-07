import { useState, type ChangeEvent } from 'react';
import { Bookmark, Plus, Trash2, Copy, Check, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { deleteSnapshot, listSnapshots, saveSnapshot, type Snapshot } from '../lib/storage';
import './SnapshotsPanel.css';

interface SnapshotsPanelProps {
  raw: string;
  onLoad: (raw: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SnapshotsPanel({ raw, onLoad, collapsed = false, onToggleCollapse }: SnapshotsPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => listSnapshots());
  const [name, setName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleSave() {
    const trimmed = name.trim();
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const label = trimmed || `Snapshot ${timeString}`;
    const snapshot = saveSnapshot(label, raw);
    setSnapshots((prev) => [snapshot, ...prev]);
    setName('');
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteSnapshot(id);
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleCopy(content: string, id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
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
            className="button-primary"
            style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
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
                    >
                      {copiedId === s.id ? <Check size={12} style={{ color: 'var(--semantic-success)' }} /> : <Copy size={12} />}
                    </button>
                    <button
                      type="button"
                      className="button-tertiary button-icon-only snapshot-action-btn delete-btn"
                      onClick={(e) => handleDelete(s.id, e)}
                      title="Delete snapshot"
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
    </aside>
  );
}
