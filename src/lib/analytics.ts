// The only module in the app that touches window.gtag.
//
// THE RULE FOR EVERY CALL SITE: pass interaction *shape*, never user data or
// content. Event params should be things like view-mode names, converter format
// ids, pass/fail statuses, or coarse size buckets — never the JSON a user typed,
// pasted, uploaded, or a filename they chose. This app's whole pitch is that
// nothing leaves the browser; analytics must not quietly break that promise.
// sanitize() below is a backstop for careless call sites, not the defense.
import { loadConsent, saveConsent, type ConsentValue } from './storage';

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const ENABLED = import.meta.env.PROD;

// GA4 caps param values at 100 chars; cap lower since nothing legitimate here
// needs more than a short enum-ish token. Also drop shapes that look like
// leaked content rather than shape.
const MAX_VALUE_LENGTH = 64;
const PEM_RE = /-----\s*BEGIN/i;
const SECRET_LIKE_RE = /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/; // JWT-shaped, tokens, etc.

function sanitize(params: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value !== 'string') {
      clean[key] = value;
      continue;
    }
    const text = value.trim();
    if (!text || text.length > MAX_VALUE_LENGTH) continue;
    if (PEM_RE.test(text) || SECRET_LIKE_RE.test(text)) continue;
    clean[key] = text;
  }
  return clean;
}

export function track(event: string, params: Record<string, unknown> = {}): void {
  const clean = sanitize(params);
  if (!ENABLED) {
    console.debug('[analytics]', event, clean);
    return;
  }
  window.gtag?.('event', event, clean);
}

const lastFiredAt = new Map<string, number>();

/** For keystroke-driven events — without this, typing sends one hit per character. */
export function trackThrottled(
  event: string,
  params: Record<string, unknown> = {},
  windowMs = 3000,
  key = event
): void {
  const now = Date.now();
  if (now - (lastFiredAt.get(key) ?? 0) < windowMs) return;
  lastFiredAt.set(key, now);
  track(event, params);
}

/** This is a single-page app with no router — GA's automatic page_view only
 *  fires once on load, so view-mode switches are reported as virtual views. */
export function trackPageView(path: string, title: string): void {
  if (!ENABLED) {
    console.debug('[analytics] page_view', path, title);
    return;
  }
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: title,
  });
}

/** Coarse size bucket for a document — never the document itself. */
export function sizeBucket(chars: number): string {
  if (chars === 0) return '0';
  if (chars < 1_000) return '<1k';
  if (chars < 10_000) return '1k-10k';
  if (chars < 100_000) return '10k-100k';
  if (chars < 1_000_000) return '100k-1m';
  return '>1m';
}

export type { ConsentValue };

export function getStoredConsent(): ConsentValue | null {
  return loadConsent();
}

export function setConsent(value: ConsentValue): void {
  saveConsent(value);
  window.gtag?.('consent', 'update', { analytics_storage: value });
}

let errorHandlersInstalled = false;

/** Pipes uncaught errors into GA so breakage shows up somewhere other than a
 *  user's console. Only the error's own message/shape is sent. */
export function installErrorTracking(): void {
  if (errorHandlersInstalled) return;
  errorHandlersInstalled = true;

  window.addEventListener('error', (e) => {
    track('js_error', {
      error_message: e.message?.slice(0, MAX_VALUE_LENGTH),
      error_source: e.filename ? e.filename.split('/').pop() : undefined,
      error_line: e.lineno,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? '');
    track('unhandled_rejection', { error_message: message.slice(0, MAX_VALUE_LENGTH) });
  });
}
