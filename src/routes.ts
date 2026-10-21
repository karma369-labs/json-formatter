// Single source of truth for the app's crawlable routes.
//
// Every tool gets its own URL so each can rank for its own search intent, but
// they all mount the same <App> — a route only changes the default view, the
// on-page heading/intro copy, and the per-route <head> (title, description,
// canonical, OpenGraph, JSON-LD).
//
// This module is imported three ways and must stay browser-global-free so it
// is safe in all of them: by App.tsx (client render + hydration), by
// entry-server.tsx (the build-time SSR render), and by scripts/prerender.mjs
// (which reads the exported table off the compiled SSR bundle to know which
// files to emit and what head to stamp into each). Keeping ROUTES here is what
// prevents the client route list and the prerender route list from drifting.
import type { ViewMode } from './hooks/useJsonEditor';

/** Canonical origin. Matches index.html, robots.txt, and sitemap.xml — change
 *  all of them together (see CLAUDE.md's SEO note). No trailing slash. */
export const SITE_ORIGIN = 'https://www.jsonspace.io';

export interface RouteMeta {
  /** URL path, leading slash, no trailing slash except the root '/'. */
  path: string;
  /** Full <title>. */
  title: string;
  /** Meta description and OG/Twitter description. */
  description: string;
  /** Visible <h1> on the page. */
  h1: string;
  /** One or two sentences of visible intro copy under the h1. Placeholder-real
   *  text; the marketing team's final copy slots in here per route. */
  intro: string;
  /** Which editor view the page opens in. */
  defaultView: ViewMode;
  /** Open the Compare modal on load (the /compare landing). */
  opensCompare?: boolean;
  /** Open the Convert modal on load, preselecting this target format. */
  convertTo?: 'xml' | 'yaml' | 'csv' | 'tsv';
  /** Open the Import modal on load, preselecting this source format. */
  importFrom?: 'csv' | 'xml' | 'yaml';
}

export const ROUTES: RouteMeta[] = [
  {
    path: '/',
    title: 'JSONSpace — Free Online JSON Formatter, Validator & Viewer',
    description:
      'Free online JSON formatter, validator, and viewer. Beautify, minify, convert to XML/YAML/CSV, and diff JSON — 100% client-side, nothing ever leaves your browser.',
    h1: 'JSON Formatter & Validator',
    intro:
      'Paste JSON to format, validate, and explore it instantly. Everything runs in your browser, so your data never leaves your machine.',
    defaultView: 'text',
  },
  {
    path: '/validator',
    title: 'JSON Validator — Check JSON Syntax Online | JSONSpace',
    description:
      'Validate JSON online and find syntax errors with exact line and column numbers. Free, instant, and fully client-side — your JSON never leaves the browser.',
    h1: 'JSON Validator',
    intro:
      'Paste JSON to check it against the spec. Errors are pinpointed by line and column so you can fix them fast.',
    defaultView: 'text',
  },
  {
    path: '/formatter',
    title: 'JSON Formatter — Beautify & Pretty-Print JSON | JSONSpace',
    description:
      'Format and pretty-print JSON online with 2, 3, 4-space, or tab indentation. Free, instant, and fully client-side.',
    h1: 'JSON Formatter',
    intro:
      'Turn minified or messy JSON into clean, indented, readable output. Choose your indentation and copy the result.',
    defaultView: 'text',
  },
  {
    path: '/beautifier',
    title: 'JSON Beautifier — Make JSON Readable Online | JSONSpace',
    description:
      'Beautify JSON online — add indentation and line breaks to make dense JSON readable. Free, instant, client-side.',
    h1: 'JSON Beautifier',
    intro:
      'Expand compact JSON into a clean, indented layout that is easy to read and scan.',
    defaultView: 'text',
  },
  {
    path: '/minifier',
    title: 'JSON Minifier — Compress JSON Online | JSONSpace',
    description:
      'Minify JSON online to strip whitespace and shrink payload size. Free, instant, and fully client-side.',
    h1: 'JSON Minifier',
    intro:
      'Strip whitespace and line breaks to produce the smallest valid JSON for faster transfer and storage.',
    defaultView: 'text',
  },
  {
    path: '/viewer',
    title: 'JSON Viewer — Browse JSON as an Interactive Tree | JSONSpace',
    description:
      'View JSON online as a collapsible, searchable tree. Explore deeply nested structures and copy any value or JSONPath. Free and client-side.',
    h1: 'JSON Viewer',
    intro:
      'Explore JSON as a collapsible tree. Search keys and values, expand only what you need, and copy any path.',
    defaultView: 'tree',
  },
  {
    path: '/graph-viewer',
    title: 'JSON Graph Viewer — Visualize JSON Structure | JSONSpace',
    description:
      'Visualize JSON as a node graph to see how objects and arrays connect. Free, interactive, and fully client-side.',
    h1: 'JSON Graph Viewer',
    intro:
      'See the shape of your JSON as a connected graph of nodes, useful for understanding nested API responses at a glance.',
    defaultView: 'graph',
  },
  {
    path: '/sorter',
    title: 'JSON Sorter — Sort JSON Keys Alphabetically | JSONSpace',
    description:
      'Sort JSON object keys alphabetically, recursively, online. Free, instant, and fully client-side.',
    h1: 'JSON Sorter',
    intro:
      'Reorder object keys alphabetically at every level to produce stable, diff-friendly JSON.',
    defaultView: 'text',
  },
  {
    path: '/compare',
    title: 'JSON Diff & Compare — Find Differences Online | JSONSpace',
    description:
      'Compare two JSON documents and see what changed. Free online JSON diff — instant and fully client-side.',
    h1: 'JSON Diff & Compare',
    intro:
      'Paste two JSON documents to see added, removed, and changed values side by side.',
    defaultView: 'text',
    opensCompare: true,
  },
  {
    path: '/converter/json-to-yaml',
    title: 'JSON to YAML Converter — Online & Free | JSONSpace',
    description:
      'Convert JSON to YAML online. Free, instant, and fully client-side — your data never leaves the browser.',
    h1: 'JSON to YAML Converter',
    intro:
      'Paste JSON and convert it to clean YAML, ready to copy into config files.',
    defaultView: 'text',
    convertTo: 'yaml',
  },
  {
    path: '/converter/json-to-xml',
    title: 'JSON to XML Converter — Online & Free | JSONSpace',
    description:
      'Convert JSON to XML online. Free, instant, and fully client-side.',
    h1: 'JSON to XML Converter',
    intro:
      'Paste JSON and convert it to well-formed XML in one step.',
    defaultView: 'text',
    convertTo: 'xml',
  },
  {
    path: '/converter/json-to-csv',
    title: 'JSON to CSV Converter — Online & Free | JSONSpace',
    description:
      'Convert JSON to CSV online. Turn arrays of objects into spreadsheet-ready CSV. Free and client-side.',
    h1: 'JSON to CSV Converter',
    intro:
      'Paste an array of JSON objects and convert it to CSV you can open in any spreadsheet.',
    defaultView: 'text',
    convertTo: 'csv',
  },
  {
    path: '/converter/json-to-tsv',
    title: 'JSON to TSV Converter — Online & Free | JSONSpace',
    description:
      'Convert JSON to TSV (tab-separated values) online. Free, instant, and client-side.',
    h1: 'JSON to TSV Converter',
    intro:
      'Paste an array of JSON objects and convert it to tab-separated values.',
    defaultView: 'text',
    convertTo: 'tsv',
  },
  {
    path: '/converter/csv-to-json',
    title: 'CSV to JSON Converter — Online & Free | JSONSpace',
    description:
      'Convert CSV or TSV to JSON online. Header rows become keys, and numbers and booleans are detected. Free and fully client-side.',
    h1: 'CSV to JSON Converter',
    intro:
      'Paste CSV or TSV, or open a file, and get an array of JSON objects keyed by the header row.',
    defaultView: 'text',
    importFrom: 'csv',
  },
  {
    path: '/converter/xml-to-json',
    title: 'XML to JSON Converter — Online & Free | JSONSpace',
    description:
      'Convert XML to JSON online. Attributes, repeated elements, and text content all map to clean JSON. Free and fully client-side.',
    h1: 'XML to JSON Converter',
    intro:
      'Paste XML and get JSON back. Attributes become "@" keys and repeated tags become arrays.',
    defaultView: 'text',
    importFrom: 'xml',
  },
  {
    path: '/converter/yaml-to-json',
    title: 'YAML to JSON Converter — Online & Free | JSONSpace',
    description:
      'Convert YAML to JSON online, including multi-document files. Free, instant, and fully client-side.',
    h1: 'YAML to JSON Converter',
    intro:
      'Paste YAML config and get the equivalent JSON, ready to load into the editor or copy.',
    defaultView: 'text',
    importFrom: 'yaml',
  },
];

/** Served by Apache for any URL with no page (see public/.htaccess), with a
 *  real 404 status. Kept out of ROUTES so it never reaches the sitemap or the
 *  tool links, and prerendered to dist/404.html with a noindex tag. */
export const NOT_FOUND_ROUTE: RouteMeta = {
  path: '/404',
  title: 'Page Not Found | JSONSpace',
  description: 'This page does not exist. Every JSONSpace tool is listed on this page.',
  h1: 'Page not found',
  intro:
    'There is nothing at this address. The formatter above still works, and every tool is listed below.',
  defaultView: 'text',
};

const ROUTES_BY_PATH = new Map(ROUTES.map((r) => [r.path, r]));

/** Resolve a pathname to its route metadata. Trailing slashes are ignored so
 *  '/validator' and '/validator/' resolve to the same route. Unknown paths
 *  resolve to the 404 route, matching the dist/404.html Apache serves there. */
export function getRouteByPath(pathname: string): RouteMeta {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return ROUTES_BY_PATH.get(normalized) ?? NOT_FOUND_ROUTE;
}

/** Short link text for a route, e.g. "JSON to YAML" for the converter page. */
export function navLabel(route: RouteMeta): string {
  return route.h1.replace(/ Converter$/, '');
}

/** Every page except home, split into the two groups the site links by. */
export const TOOL_ROUTES = ROUTES.filter((r) => r.path !== '/' && !r.path.startsWith('/converter/'));
export const CONVERTER_ROUTES = ROUTES.filter((r) => r.path.startsWith('/converter/'));
