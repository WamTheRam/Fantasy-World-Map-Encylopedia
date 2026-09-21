import { memo, type KeyboardEvent } from 'react';
import { cx } from '@/components/common/cx';
import type { PointLocation } from '@/types/world';
import { ICONS, iconFor, typeLabel } from './locationIcons';
import styles from './Map.module.css';

interface PointMarkerProps {
  location: PointLocation;
  selected: boolean;
  /** Being redrawn: shown faded and inert. */
  ghost?: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

/**
 * A city or point-of-interest marker.
 *
 * Structure matters here. The outer <g> positions the marker in map space. The
 * `markerScale` group cancels the map's zoom (via the --s CSS variable) so the
 * marker stays a constant on-screen size, and everything inside is drawn in
 * ordinary pixels. Hover effects live on an inner group so they never fight
 * with that zoom-cancelling transform while the camera is moving.
 */
export const PointMarker = memo(function PointMarker({ location, selected, ghost = false, onSelect, onHover }: PointMarkerProps) {
  const icon = iconFor(location);
  const { x, y } = location.coordinates;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(location.id);
    }
  };

  return (
    <g
      transform={`translate(${x} ${y})`}
      className={cx(styles.marker, selected && styles.markerSelected, ghost && styles.markerGhost)}
      role="button"
      tabIndex={0}
      aria-label={`${location.name}, ${typeLabel(location)}`}
      aria-pressed={selected}
      onClick={() => onSelect(location.id)}
      onKeyDown={onKeyDown}
      onPointerEnter={() => onHover(location.id)}
      onPointerLeave={() => onHover(null)}
    >
      <g className={styles.markerScale}>
        <g className={styles.markerBody}>
          {selected && <circle className={styles.markerPulse} r={15} />}
          <circle className={styles.markerHit} r={14} />
          <circle className={styles.markerBadge} r={10} />
          <g className={cx(styles.glyph, icon === 'capital' && styles.glyphCapital)} transform="scale(.9)">
            {ICONS[icon].glyph}
          </g>
          <text className={styles.markerLabel} x={16} y={0}>
            {location.name}
          </text>
        </g>
      </g>
    </g>
  );
});
