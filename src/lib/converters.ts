// Pure JSON -> {XML, CSV, TSV, YAML, escaped string} converters. No UI, no DOM.

export type ConverterFormat = 'xml' | 'csv' | 'tsv' | 'yaml' | 'escape' | 'unescape';

export interface ConvertResult {
  output: string;
  fileExtension: string;
  mimeType: string;
}

// ---------- XML ----------

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeXmlTag(key: string): string {
  let tag = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
  if (!/^[a-zA-Z_]/.test(tag)) tag = `_${tag}`;
  return tag || 'item';
}

function xmlNode(value: unknown, tag: string, indent: string): string {
  if (value === null || value === undefined) {
    return `${indent}<${tag}/>`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `${indent}<${tag}/>`;
    return value.map((item) => xmlNode(item, tag, indent)).join('\n');
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return `${indent}<${tag}/>`;
    const inner = entries.map(([k, v]) => xmlNode(v, sanitizeXmlTag(k), `${indent}  `)).join('\n');
    return `${indent}<${tag}>\n${inner}\n${indent}</${tag}>`;
  }
  return `${indent}<${tag}>${xmlEscape(String(value))}</${tag}>`;
}

export function jsonToXml(value: unknown, rootName = 'root'): string {
  const header = '<?xml version="1.0" encoding="UTF-8"?>';
  const tag = sanitizeXmlTag(rootName);
  let body: string;
  if (Array.isArray(value)) {
    body = value.length === 0
      ? `<${tag}/>`
      : `<${tag}>\n${value.map((item) => xmlNode(item, 'item', '  ')).join('\n')}\n</${tag}>`;
  } else {
    body = xmlNode(value, tag, '');
  }
  return `${header}\n${body}`;
}

// ---------- CSV / TSV ----------

function flattenValue(value: unknown, prefix: string, out: Record<string, string>): void {
  if (value === null || value === undefined) {
    out[prefix] = '';
  } else if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== 'object')) {
      out[prefix] = value.map((v) => String(v)).join('; ');
    } else {
      value.forEach((v, i) => flattenValue(v, `${prefix}[${i}]`, out));
    }
  } else if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      out[prefix] = '';
    } else {
      entries.forEach(([k, v]) => flattenValue(v, prefix ? `${prefix}.${k}` : k, out));
    }
  } else {
    out[prefix] = String(value);
  }
}

function rowToFlat(item: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      flattenValue(v, k, out);
    }
  } else {
    flattenValue(item, 'value', out);
  }
  return out;
}

function jsonToDelimited(value: unknown, delimiter: ',' | '\t'): string {
  const label = delimiter === ',' ? 'CSV' : 'TSV';
  if (!Array.isArray(value)) {
    throw new Error(`${label} conversion requires a JSON array at the top level.`);
  }
  if (value.length === 0) return '';

  const rows = value.map(rowToFlat);
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));

  function escapeCell(cell: string): string {
    if (delimiter === ',') {
      return /["\n,]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
    }
    return cell.replace(/\t/g, ' ').replace(/\n/g, ' ');
  }

  const lines = [headers.map(escapeCell).join(delimiter)];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h] ?? '')).join(delimiter));
  }
  return lines.join('\n');
}

export function jsonToCsv(value: unknown): string {
  return jsonToDelimited(value, ',');
}

export function jsonToTsv(value: unknown): string {
  return jsonToDelimited(value, '\t');
}

// ---------- YAML ----------

function yamlNeedsQuoting(str: string): boolean {
  if (str === '') return true;
  if (/^\s|\s$/.test(str)) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(str)) return true;
  if (/:\s|:$/.test(str)) return true;
  if (/\s#/.test(str)) return true;
  if (/^(true|false|null|yes|no|~)$/i.test(str)) return true;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(str)) return true;
  if (str.includes('\n')) return true;
  return false;
}

function yamlQuote(str: string): string {
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function yamlScalar(str: string): string {
  return yamlNeedsQuoting(str) ? yamlQuote(str) : str;
}

function emitYaml(value: unknown, indent: number): string {
  const pad = '  '.repeat(indent);

  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return yamlScalar(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object' && Object.keys(item as object).length > 0) {
          const nested = emitYaml(item, indent + 1).split('\n');
          return `${pad}- ${nested[0].trimStart()}\n${nested.slice(1).join('\n')}`;
        }
        return `${pad}- ${emitYaml(item, indent + 1)}`;
      })
      .join('\n');
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  return entries
    .map(([k, v]) => {
      const key = yamlNeedsQuoting(k) ? yamlQuote(k) : k;
      if (v !== null && typeof v === 'object' && Object.keys(v as object).length > 0) {
        return `${pad}${key}:\n${emitYaml(v, indent + 1)}`;
      }
      return `${pad}${key}: ${emitYaml(v, indent + 1)}`;
    })
    .join('\n');
}

export function jsonToYaml(value: unknown): string {
  if (value === null || value === undefined) return 'null\n';
  if (typeof value !== 'object') return `${yamlScalar(String(value))}\n`;
  return `${emitYaml(value, 0)}\n`;
}

// ---------- Escape / Unescape ----------

export function jsonToEscapedString(raw: string): string {
  return JSON.stringify(raw);
}

export function unescapeJsonString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Unescape expects the document to be a single quoted JSON string, e.g. "line1\\nline2".');
  }
  return value;
}

// ---------- Dispatcher ----------

export function convertJson(format: ConverterFormat, raw: string, parsed: unknown): ConvertResult {
  switch (format) {
    case 'xml':
      return { output: jsonToXml(parsed), fileExtension: 'xml', mimeType: 'application/xml' };
    case 'csv':
      return { output: jsonToCsv(parsed), fileExtension: 'csv', mimeType: 'text/csv' };
    case 'tsv':
      return { output: jsonToTsv(parsed), fileExtension: 'tsv', mimeType: 'text/tab-separated-values' };
    case 'yaml':
      return { output: jsonToYaml(parsed), fileExtension: 'yaml', mimeType: 'application/x-yaml' };
    case 'escape':
      return { output: jsonToEscapedString(raw), fileExtension: 'txt', mimeType: 'text/plain' };
    case 'unescape':
      return { output: unescapeJsonString(parsed), fileExtension: 'txt', mimeType: 'text/plain' };
  }
}
