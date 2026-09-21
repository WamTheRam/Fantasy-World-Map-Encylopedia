import { memo, type CSSProperties, type KeyboardEvent } from 'react';
import { cx } from '@/components/common/cx';
import styles from './Map.module.css';

export type AreaStatus = 'idle' | 'selected' | 'dimmed';

interface AreaShapeProps {
  id: string;
  kind: 'country' | 'region';
  /** SVG path data. */
  d: string;
  fill: string;
  status: AreaStatus;
  label: string;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

/** One clickable country or region polygon. Colour comes in as a CSS variable so the stylesheet owns all the styling. */
export const AreaShape = memo(function AreaShape({ id, kind, d, fill, status, label, onSelect, onHover }: AreaShapeProps) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <path
      d={d}
      className={cx(
        styles.area,
        kind === 'country' ? styles.country : styles.region,
        status === 'selected' && styles.selected,
        status === 'dimmed' && styles.dimmed,
      )}
      style={{ '--fill': fill } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={status === 'selected'}
      onClick={() => onSelect(id)}
      onKeyDown={onKeyDown}
      onPointerEnter={() => onHover(id)}
      onPointerLeave={() => onHover(null)}
    />
  );
});
