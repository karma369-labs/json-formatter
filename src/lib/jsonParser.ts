// Pure JSON parse/format/validate helpers. No UI, no DOM — easy to unit test.

export interface ParseError {
  message: string;
  line: number;
  column: number;
  position: number;
}

export interface ParseResult {
  success: boolean;
  value?: unknown;
  error?: ParseError;
}

export function parseJson(input: string): ParseResult {
  if (input.trim() === '') {
    return { success: true, value: undefined };
  }
  try {
    const value = JSON.parse(input);
    return { success: true, value };
  } catch (err) {
    return { success: false, error: toParseError(err, input) };
  }
}

function toParseError(err: unknown, input: string): ParseError {
  const message = err instanceof Error ? err.message : 'Invalid JSON';
  const position = extractPosition(message, input);
  const { line, column } = positionToLineColumn(input, position);
  return { message, line, column, position };
}

function extractPosition(message: string, input: string): number {
  const posMatch = message.match(/position (\d+)/);
  if (posMatch) return Number(posMatch[1]);

  // Firefox/Safari style: "...JSON.parse: unexpected character at line 2 column 3..."
  const lineColMatch = message.match(/line (\d+) column (\d+)/);
  if (lineColMatch) {
    return lineColumnToPosition(input, Number(lineColMatch[1]), Number(lineColMatch[2]));
  }
  return 0;
}

function positionToLineColumn(input: string, position: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(position, input.length));
  const upToPosition = input.slice(0, clamped);
  const lines = upToPosition.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function lineColumnToPosition(input: string, line: number, column: number): number {
  const lines = input.split('\n');
  let position = 0;
  for (let i = 0; i < line - 1; i++) {
    position += lines[i].length + 1;
  }
  return position + column - 1;
}

export type IndentOption = 2 | 3 | 4 | 'tab';

export function indentValue(indent: IndentOption): string | number {
  return indent === 'tab' ? '\t' : indent;
}

export function formatJson(value: unknown, indent: IndentOption): string {
  return JSON.stringify(value, null, indentValue(indent));
}

export function minifyJson(value: unknown): string {
  return JSON.stringify(value);
}

export function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJsonKeys((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export function repairJson(input: string): string {
  if (!input.trim()) return input;
  let repaired = input;
  // 1. Remove single-line and multi-line comments
  repaired = repaired.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // 2. Wrap unquoted object keys in double quotes: { key: "val" } -> { "key": "val" }
  repaired = repaired.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
  // 3. Convert single quoted strings to double quoted strings
  repaired = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
  // 4. Remove trailing commas before closing braces or brackets: , } -> }
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');
  return repaired;
}
