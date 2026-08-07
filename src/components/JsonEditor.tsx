import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import './JsonEditor.css';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

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
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
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

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!containerRef.current) return;

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
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return <div className="json-editor" ref={containerRef} />;
}
