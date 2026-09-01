// SSR/prerender-safe primitives for values that only exist in the browser.
//
// The app is prerendered to static HTML at build time (scripts/prerender.mjs),
// so every component renders once in Node — where window/navigator/localStorage
// don't exist — and then again on the client for hydration. Reading a browser
// value directly in a render path (or in a useState initializer, which also
// runs during hydration) makes those two renders disagree and produces a
// hydration mismatch.
//
// Both hooks below use useSyncExternalStore, which is built for exactly this:
// its getServerSnapshot supplies the value used by the server render AND the
// client's hydration render, and React then reconciles to the real client
// value immediately afterwards — no mismatch warning, and no setState-in-effect
// (which this repo's eslint config rightly rejects).
import { useSyncExternalStore } from 'react';

const subscribeNoop = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

/**
 * False during the server render and the client's hydration render, true from
 * the first post-hydration render onward. Gate one-shot browser reads that
 * can't change over time (e.g. navigator.platform) behind this.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNoop, getTrue, getFalse);
}

interface MediaQueryStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => boolean;
}

// Cached per query string so repeated calls reuse one MediaQueryList and, more
// importantly, hand useSyncExternalStore stable function identities.
const mediaStores = new Map<string, MediaQueryStore>();

function getMediaStore(query: string): MediaQueryStore {
  let store = mediaStores.get(query);
  if (!store) {
    const mql = typeof window !== 'undefined' ? window.matchMedia(query) : null;
    store = {
      subscribe: (onChange) => {
        mql?.addEventListener('change', onChange);
        return () => mql?.removeEventListener('change', onChange);
      },
      // Reads the MediaQueryList's cached `matches` rather than window
      // dimensions, so this costs nothing and never forces a layout reflow.
      getSnapshot: () => mql?.matches ?? false,
    };
    mediaStores.set(query, store);
  }
  return store;
}

/** Reactive, SSR-safe media query. Always false on the server/hydration render. */
export function useMediaQuery(query: string): boolean {
  const store = getMediaStore(query);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, getFalse);
}
