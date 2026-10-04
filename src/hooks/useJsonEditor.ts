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

export type ViewMode = 'text' | 'tree' | 'graph';

export interface JsonEditorState {
  raw: string;
  parsed: unknown;
  error: ParseError | null;
  indent: IndentOption;
  viewMode: ViewMode;
  splitView: boolean;
  /** Line count and UTF-8 size of `raw`, refreshed with each parse rather
   *  than on every keystroke. Both scan the whole document, which costs
   *  ~20ms per key press on a multi-megabyte file. */
  lines: number;
  bytes: number;
  /** The `raw` that `parsed`/`error` came from. They trail `raw` by the
   *  parse debounce, and this is how actions tell. */
  parsedFrom: string;
  /** Bumped when a whole new document is loaded (file, sample, snapshot,
   *  import), never by typing, so views can reset what the user opened. */
  docId: number;
}

type Action =
  | { type: 'setRaw'; raw: string }
  | { type: 'commitParse'; raw: string }
  | { type: 'format' }
  | { type: 'minify' }
  | { type: 'sortKeys' }
  | { type: 'repair' }
  | { type: 'setIndent'; indent: IndentOption }
  | { type: 'setViewMode'; mode: ViewMode }
  | { type: 'setSplitView'; split: boolean }
  | { type: 'loadContent'; raw: string };

type Parsed = Pick<JsonEditorState, 'parsed' | 'error' | 'lines' | 'bytes' | 'parsedFrom'>;

function reparse(raw: string): Parsed {
  const result = parseJson(raw);
  return {
    parsedFrom: raw,
    parsed: result.success ? result.value : undefined,
    error: result.success ? null : (result.error ?? null),
    lines: raw ? raw.split('\n').length : 0,
    bytes: new Blob([raw]).size,
  };
}

// Format, minify and sort rebuild the document from `parsed`. If the user
// typed within the last ~250ms, `parsed` predates that typing and using it
// would silently drop the new text, so those actions parse fresh first.
function freshParse(state: JsonEditorState): Parsed {
  return state.parsedFrom === state.raw ? state : reparse(state.raw);
}

function reducer(state: JsonEditorState, action: Action): JsonEditorState {
  switch (action.type) {
    // Raw text updates immediately (so typing never stalls); parsing is
    // debounced separately via 'commitParse' so a full JSON.parse doesn't
    // run synchronously on every keystroke of a large document.
    case 'setRaw':
      return { ...state, raw: action.raw };

    case 'commitParse':
      if (action.raw !== state.raw) return state;
      return { ...state, ...reparse(action.raw) };

    case 'format': {
      const fresh = freshParse(state);
      if (fresh.error || fresh.parsed === undefined) return { ...state, ...fresh };
      return { ...state, ...fresh, raw: formatJson(fresh.parsed, state.indent) };
    }

    case 'minify': {
      const fresh = freshParse(state);
      if (fresh.error || fresh.parsed === undefined) return { ...state, ...fresh };
      return { ...state, ...fresh, raw: minifyJson(fresh.parsed) };
    }

    case 'sortKeys': {
      const fresh = freshParse(state);
      if (fresh.error || fresh.parsed === undefined) return { ...state, ...fresh };
      const sorted = sortJsonKeys(fresh.parsed);
      return { ...state, ...fresh, raw: formatJson(sorted, state.indent), parsed: sorted };
    }

    case 'repair': {
      const repaired = repairJson(state.raw);
      return { ...state, raw: repaired, ...reparse(repaired) };
    }

    case 'setIndent':
      return { ...state, indent: action.indent };

    case 'setViewMode':
      return { ...state, viewMode: action.mode };

    case 'setSplitView':
      return { ...state, splitView: action.split };

    case 'loadContent':
      return { ...state, raw: action.raw, docId: state.docId + 1, ...reparse(action.raw) };

    default:
      return state;
  }
}

// Always starts empty rather than calling loadCurrentDoc() here: this
// initializer runs during render (including server/prerender render, where
// localStorage doesn't exist), so seeding it with a returning visitor's saved
// document would make the client's first render disagree with the static
// HTML and trigger a large hydration mismatch across the tree/editor view.
// The saved document is loaded after mount instead — see the effect below.
//
// viewMode is seeded from the route's default view. That value is derived from
// the URL, which is identical on the server render and the client's hydration
// render, so it stays SSR-safe. A 'graph' default still must not mount the lazy
// GraphView during SSR — App gates that render behind useHydrated().
function initState(initialView: ViewMode): JsonEditorState {
  const raw = '';
  return { raw, indent: 2, viewMode: initialView, splitView: true, docId: 0, ...reparse(raw) };
}

export function useJsonEditor(initialView: ViewMode = 'tree') {
  const [state, dispatch] = useReducer(reducer, initialView, initState);

  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = loadCurrentDoc();
    if (saved) dispatch({ type: 'loadContent', raw: saved });
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveCurrentDoc(state.raw), 500);
    return () => clearTimeout(saveTimer.current);
  }, [state.raw]);

  const parseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => dispatch({ type: 'commitParse', raw: state.raw }), 150);
    return () => clearTimeout(parseTimer.current);
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
    setSplitView: (split: boolean) => dispatch({ type: 'setSplitView', split }),
    loadContent: (raw: string) => dispatch({ type: 'loadContent', raw }),
  };
}
