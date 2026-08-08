// Single reducer-backed hook for all editor state, instantiated once in
// App.tsx and threaded down as props — mirrors the jwt-io project's useJwt
// pattern. No state library: the scope here doesn't need one.
import { useEffect, useReducer, useRef } from 'react';
import {
  formatJson,
  minifyJson,
  parseJson,
  repairJson,
  sortJsonKeys,
  type IndentOption,
  type ParseError,
} from '../lib/jsonParser';
import { loadCurrentDoc, saveCurrentDoc } from '../lib/storage';

export type ViewMode = 'text' | 'tree' | 'graph' | 'split';

export interface JsonEditorState {
  raw: string;
  parsed: unknown;
  error: ParseError | null;
  indent: IndentOption;
  viewMode: ViewMode;
}

type Action =
  | { type: 'setRaw'; raw: string }
  | { type: 'format' }
  | { type: 'minify' }
  | { type: 'sortKeys' }
  | { type: 'repair' }
  | { type: 'setIndent'; indent: IndentOption }
  | { type: 'setViewMode'; mode: ViewMode }
  | { type: 'loadContent'; raw: string };

function reparse(raw: string): { parsed: unknown; error: ParseError | null } {
  const result = parseJson(raw);
  return {
    parsed: result.success ? result.value : undefined,
    error: result.success ? null : (result.error ?? null),
  };
}

function reducer(state: JsonEditorState, action: Action): JsonEditorState {
  switch (action.type) {
    case 'setRaw':
      return { ...state, raw: action.raw, ...reparse(action.raw) };

    case 'format':
      if (state.error || state.parsed === undefined) return state;
      return { ...state, raw: formatJson(state.parsed, state.indent) };

    case 'minify':
      if (state.error || state.parsed === undefined) return state;
      return { ...state, raw: minifyJson(state.parsed) };

    case 'sortKeys': {
      if (state.error || state.parsed === undefined) return state;
      const sorted = sortJsonKeys(state.parsed);
      return { ...state, raw: formatJson(sorted, state.indent), parsed: sorted };
    }

    case 'repair': {
      const repaired = repairJson(state.raw);
      return { ...state, raw: repaired, ...reparse(repaired) };
    }

    case 'setIndent':
      return { ...state, indent: action.indent };

    case 'setViewMode':
      return { ...state, viewMode: action.mode };

    case 'loadContent':
      return { ...state, raw: action.raw, ...reparse(action.raw) };

    default:
      return state;
  }
}

function initState(): JsonEditorState {
  const raw = loadCurrentDoc() ?? '';
  return { raw, indent: 2, viewMode: 'split', ...reparse(raw) };
}

export function useJsonEditor() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveCurrentDoc(state.raw), 500);
    return () => clearTimeout(saveTimer.current);
  }, [state.raw]);

  return {
    state,
    setRaw: (raw: string) => dispatch({ type: 'setRaw', raw }),
    format: () => dispatch({ type: 'format' }),
    minify: () => dispatch({ type: 'minify' }),
    sortKeys: () => dispatch({ type: 'sortKeys' }),
    repair: () => dispatch({ type: 'repair' }),
    setIndent: (indent: IndentOption) => dispatch({ type: 'setIndent', indent }),
    setViewMode: (mode: ViewMode) => dispatch({ type: 'setViewMode', mode }),
    loadContent: (raw: string) => dispatch({ type: 'loadContent', raw }),
  };
}
