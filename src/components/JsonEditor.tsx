import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import './JsonEditor.css';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { sizeBucket, trackThrottled } from '../lib/analytics';

/** How long typing must pause before the edited text reaches the parent. */
const EMIT_DELAY_MS = 100;

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const obsidianHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--token-key)', fontWeight: '500' },
  { tag: tags.string, color: 'var(--token-string)' },
  { tag: tags.number, color: 'var(--token-number)' },
  { tag: tags.bool, color: 'var(--token-boolean)' },
  { tag: tags.null, color: 'var(--token-null)' },
  { tag: tags.punctuation, color: 'var(--token-bracket)' },
  { tag: tags.squareBracket, color: 'var(--token-bracket)' },
  { tag: tags.brace, color: 'var(--token-bracket)' },
]);

const obsidianTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--surface-1)',
      color: 'var(--ink)',
      height: '100%',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      lineHeight: '1.6',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--surface-1)',
      color: 'var(--ink-tertiary)',
      borderRight: '1px solid var(--hairline)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--surface-2)',
      color: 'var(--ink)',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--overlay-medium)',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(94, 106, 210, 0.3) !important',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--primary)',
    },
  },
  { dark: true }
);

export function JsonEditor({ value, onChange }: JsonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // The last text this editor reported upward, which always matches the view
  // once no emit is pending. When `value` comes back as that same text, the
  // view already holds it and the sync effect can skip a full compare.
  const lastEmitted = useRef(value);
  // Set while the sync effect pushes `value` into the view, so the update
  // listener doesn't echo that change straight back up as an edit.
  const syncing = useRef(false);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // doc.toString() rebuilds the whole document, which takes ~40ms on a
    // 3MB file. Doing it per keystroke capped typing at ~20 FPS, so edits
    // reach the parent once typing pauses instead.
    let emitTimer: ReturnType<typeof setTimeout> | undefined;

    function emit(view: EditorView) {
      clearTimeout(emitTimer);
      emitTimer = undefined;
      const next = view.state.doc.toString();
      lastEmitted.current = next;
      onChangeRef.current(next);
    }

    function flush(view: EditorView) {
      if (emitTimer !== undefined) emit(view);
    }

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          json(),
          syntaxHighlighting(obsidianHighlightStyle),
          obsidianTheme,
          // The parent must see the latest text before anything reads it.
          // Toolbar clicks blur the editor first, and the global Ctrl/Cmd
          // shortcuts listen on window, so this keydown runs before them.
          // Observers rather than handlers: a keymap binding such as
          // Mod-Enter claims the event and would skip a handler.
          EditorView.domEventObservers({
            blur: (_e, v) => flush(v),
            keydown: (e, v) => {
              if (e.ctrlKey || e.metaKey) flush(v);
            },
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || syncing.current) return;
            clearTimeout(emitTimer);
            emitTimer = setTimeout(() => emit(update.view), EMIT_DELAY_MS);
            // Keystroke-driven, so throttle hard — and only for edits the
            // user actually typed, not the programmatic value dispatch below.
            const isUserEdit = update.transactions.some(
              (tr) => tr.isUserEvent('input') || tr.isUserEvent('delete')
            );
            if (isUserEdit) {
              trackThrottled('json_edit', { size_bucket: sizeBucket(update.state.doc.length) }, 5000);
            }
          }),
        ],
      }),
    });

    viewRef.current = view;
    return () => {
      // Switching to tree-only view unmounts the editor. Hand over any
      // unsent edit first so it isn't lost.
      flush(view);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === lastEmitted.current) return;
    // A load, format or clear from outside. It replaces the document, so any
    // unsent typing is dropped along with the old text it was typed into.
    lastEmitted.current = value;
    syncing.current = true;
    try {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    } finally {
      syncing.current = false;
    }
  }, [value]);

  return <div className="json-editor" ref={containerRef} />;
}
