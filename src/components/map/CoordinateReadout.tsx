import { useEffect, useRef, useState } from 'react';
import type { MapViewport } from '@/hooks/useMapViewport';
import styles from './Map.module.css';

/**
 * Development aid for tracing polygons by hand: shows the map coordinate under
 * the cursor, and copies `[x, y]` to the clipboard on Shift+click. Only mounted
 * by `npm run dev`; it is not part of the production build.
 */
export function CoordinateReadout({ viewport }: { viewport: MapViewport }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const container = viewport.containerRef.current;
    if (!container) return;

    const onMove = (e: PointerEvent) => {
      const point = viewport.clientToMap(e.clientX, e.clientY);
      if (point && textRef.current) {
        textRef.current.textContent = `x ${Math.round(point[0])}   y ${Math.round(point[1])}`;
      }
    };

    // Capture phase, so a Shift+click copies coordinates instead of selecting a polygon.
    const onClick = (e: MouseEvent) => {
      if (!e.shiftKey) return;
      const point = viewport.clientToMap(e.clientX, e.clientY);
      if (!point) return;
      e.stopPropagation();
      e.preventDefault();
      const text = `[${Math.round(point[0])}, ${Math.round(point[1])}]`;
      void navigator.clipboard?.writeText(text);
      setCopied(text);
    };

    container.addEventListener('pointermove', onMove);
    container.addEventListener('click', onClick, true);
    return () => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('click', onClick, true);
    };
  }, [viewport]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className={styles.readout} aria-hidden="true">
      <span ref={textRef}>x –   y –</span>
      <small>{copied ? `Copied ${copied}` : 'Shift-click to copy [x, y]'}</small>
    </div>
  );
}
