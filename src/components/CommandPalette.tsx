import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';
import './CommandPalette.css';

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon: typeof Search;
  action: () => void;
  disabled?: boolean;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useModalFocus<HTMLDivElement>();

  const q = query.trim().toLowerCase();
  const filtered = q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands;

  const clampedSelected = Math.min(selected, Math.max(filtered.length - 1, 0));

  useEffect(() => {
    const active = listRef.current?.querySelector('.palette-item.active');
    active?.scrollIntoView({ block: 'nearest' });
  }, [clampedSelected]);

  function runCommand(command: Command | undefined) {
    if (!command || command.disabled) return;
    command.action();
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(filtered[clampedSelected]);
    }
  }

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        ref={containerRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="palette-input-row">
          <Search size={14} className="palette-search-icon" />
          <input
            type="text"
            className="palette-input"
            placeholder="Type a command…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>

        <ul className="palette-list" ref={listRef}>
          {filtered.length === 0 ? (
            <li className="palette-empty">No matching commands</li>
          ) : (
            filtered.map((c, i) => {
              const Icon = c.icon;
              return (
                <li
                  key={c.id}
                  className={`palette-item${i === clampedSelected ? ' active' : ''}${c.disabled ? ' disabled' : ''}`}
                  onMouseEnter={() => setSelected(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    runCommand(c);
                  }}
                >
                  <Icon size={14} />
                  <span className="palette-item-label">{c.label}</span>
                  {c.shortcut ? <kbd className="palette-kbd">{c.shortcut}</kbd> : null}
                  {i === clampedSelected && !c.disabled ? <CornerDownLeft size={12} className="palette-enter-hint" /> : null}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
