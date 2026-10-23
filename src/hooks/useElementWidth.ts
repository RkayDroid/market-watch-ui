import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Tracks the rendered width of an element via ResizeObserver.
 * Returns `fallback` until measured (and in environments without ResizeObserver, e.g. jsdom).
 */
export function useElementWidth<T extends HTMLElement>(fallback: number): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const measured = el.getBoundingClientRect().width;
      if (measured > 0) setWidth(Math.round(measured));
    };
    update();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
