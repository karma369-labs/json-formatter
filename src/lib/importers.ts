// Pure {CSV, TSV, XML, YAML} -> JSON value importers, the reverse of converters.ts.
// No React. XML uses the browser's DOMParser, so only call these from client
// code (the import modal), never from a render path that runs during prerender.
import { parseAllDocuments } from 'yaml';

export type ImportFormat = 'csv' | 'xml' | 'yaml';

export interface ImportOptions {
  /** CSV: treat the first row as column names and emit an array of objects. */
  headerRow: boolean;
  /** CSV and XML: turn "42", "true", "false" and "null" into real JSON types. */
  inferTypes: boolean;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = { headerRow: true, inferTypes: true };

// Leading zeros stay strings so ZIP codes and IDs like "007" survive.
const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

function inferScalar(text: string): unknown {
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  if (NUMBER_RE.test(text)) {
    const n = Number(text);
    // Past 2^53 a number loses digits, so keep big IDs as strings.
    if (Number.isSafeInteger(n) || !Number.isInteger(n)) return n;
  }
  return text;
}

// ---------- CSV / TSV ----------

const DELIMITERS = [',', '\t', ';', '|'] as const;

/** Pick the delimiter that appears most often in the first line, ignoring
 *  anything inside quotes. Falls back to a comma. */
function detectDelimiter(text: string): string {
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1);
  }
  let best = ',';
  for (const [d, n] of counts) if (n > counts.get(best)!) best = d;
  return best;
}

/** RFC 4180 parser: quoted fields, "" escapes, and newlines inside quotes. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else {
      field += ch;
    }
    i++;
  }
  if (inQuotes) throw new Error('A quoted field is never closed. Check for a missing " character.');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines carry no data; drop them rather than emitting empty records.
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Rename repeated or blank column names so no column overwrites another. */
function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((raw, i) => {
    const base = raw.trim() || `column_${i + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

export function csvToJson(text: string, options: ImportOptions): unknown {
  const rows = parseDelimited(text, detectDelimiter(text));
  if (rows.length === 0) return [];
  const cell = (s: string) => (options.inferTypes ? inferScalar(s) : s);

  if (!options.headerRow) return rows.map((r) => r.map(cell));

  const headers = uniqueHeaders(rows[0]);
  return rows.slice(1).map((r) => {
    const record: Record<string, unknown> = {};
    const width = Math.max(headers.length, r.length);
    for (let c = 0; c < width; c++) {
      record[headers[c] ?? `column_${c + 1}`] = cell(r[c] ?? '');
    }
    return record;
  });
}

// ---------- XML ----------

/** Element -> JSON. Attributes become "@name" keys, repeated child tags become
 *  arrays, and text beside attributes or children goes under "#text". An
 *  element holding only text collapses to that text; an empty one to null. */
function xmlElementToJson(el: Element, inferTypes: boolean): unknown {
  const cell = (s: string) => (inferTypes ? inferScalar(s) : s);
  const obj: Record<string, unknown> = {};

  for (const attr of Array.from(el.attributes)) {
    obj[`@${attr.name}`] = cell(attr.value);
  }

  let text = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as Element;
      const value = xmlElementToJson(child, inferTypes);
      const existing = obj[child.tagName];
      // An element never converts to an array, so an array here can only be
      // a list this loop built from an earlier repeat of the same tag.
      if (existing === undefined) obj[child.tagName] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else obj[child.tagName] = [existing, value];
    } else if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
      text += node.nodeValue ?? '';
    }
  }

  text = text.trim();
  if (Object.keys(obj).length === 0) return text === '' ? null : cell(text);
  if (text !== '') obj['#text'] = cell(text);
  return obj;
}

export function xmlToJson(text: string, options: ImportOptions): unknown {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    // Chrome wraps the useful part in boilerplate on the same line; Firefox
    // adds a "Location:" block after it. Strip both and keep the first line.
    const detail = (parserError.textContent ?? '')
      .replace(/This page contains the following errors?:/i, '')
      .replace(/Below is a rendering of the page up to the first error\.?/i, '')
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean);
    throw new Error(`Invalid XML${detail ? `: ${detail}` : '.'}`);
  }
  const root = doc.documentElement;
  return { [root.tagName]: xmlElementToJson(root, options.inferTypes) };
}

// ---------- YAML ----------

/** YAML 1.2 core schema, so "yes"/"no" stay strings and dates stay strings.
 *  A file with several "---" documents becomes an array of them. */
export function yamlToJson(text: string): unknown {
  const docs = Array.from(parseAllDocuments(text));
  for (const doc of docs) {
    if (doc.errors.length > 0) throw new Error(doc.errors[0].message);
  }
  const values = docs.map((doc) => doc.toJS({ maxAliasCount: 1000 }) as unknown);
  if (values.length === 0) return null;
  return values.length === 1 ? values[0] : values;
}

// ---------- Dispatcher ----------

export function importToJson(format: ImportFormat, text: string, options: ImportOptions): unknown {
  switch (format) {
    case 'csv':
      return csvToJson(text, options);
    case 'xml':
      return xmlToJson(text, options);
    case 'yaml':
      return yamlToJson(text);
  }
}
