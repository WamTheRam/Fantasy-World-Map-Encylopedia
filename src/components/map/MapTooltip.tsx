import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { cx } from '@/components/common/cx';
import styles from './Map.module.css';

export interface TooltipContent {
  title: string;
  subtitle: string;
}

interface MapTooltipProps {
  containerRef: RefObject<HTMLElement | null>;
  content: TooltipContent | null;
}

/**
 * Follows the pointer. Its position is written straight to the DOM on every
 * pointermove instead of going through React state, so hovering never causes
 * a re-render of the map.
 */
export function MapTooltip({ containerRef, content }: MapTooltipProps) {
  const tipRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const place = useCallback(() => {
    const container = containerRef.current;
    const tip = tipRef.current;
    const pointer = pointerRef.current;
    if (!container || !tip || !pointer) return;
    const rect = container.getBoundingClientRect();
    const px = pointer.x - rect.left;
    const py = pointer.y - rect.top;
    let x = px + 16;
    let y = py + 18;
    // Flip to the other side of the pointer near the edges.
    if (x + tip.offsetWidth > rect.width - 8) x = px - tip.offsetWidth - 16;
    if (y + tip.offsetHeight > rect.height - 8) y = py - tip.offsetHeight - 12;
    tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
      place();
    };
    container.addEventListener('pointermove', onMove);
    return () => container.removeEventListener('pointermove', onMove);
  }, [containerRef, place]);

  // The tooltip's size changes with its text, so re-place it whenever the content does.
  useLayoutEffect(() => {
    place();
  }, [content, place]);

  return (
    <div ref={tipRef} className={cx(styles.tooltip, content && styles.tooltipVisible)} role="tooltip">
      {content && (
        <>
          <span className={styles.tooltipTitle}>{content.title}</span>
          <span className={styles.tooltipSubtitle}>{content.subtitle}</span>
        </>
      )}
    </div>
  );
}
