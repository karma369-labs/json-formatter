import { useLayoutEffect, useRef, useState, type UIEvent } from 'react';

interface UseVirtualListOptions {
  count: number;
  rowHeight: number;
  overscan?: number;
}

/** Fixed-row-height windowing: renders only the rows within the scroll viewport (plus overscan). */
export function useVirtualList({ count, rowHeight, overscan = 8 }: UseVirtualListOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewportHeight(el.clientHeight);
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function onScroll(e: UIEvent<HTMLDivElement>) {
    setScrollTop(e.currentTarget.scrollTop);
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const endIndex = Math.min(count, startIndex + visibleCount);

  return {
    containerRef,
    onScroll,
    startIndex,
    endIndex,
    totalHeight: count * rowHeight,
    offsetY: startIndex * rowHeight,
  };
}
