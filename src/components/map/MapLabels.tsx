import { memo } from 'react';
import type { WorldIndex } from '@/lib/content/worldIndex';
import type { MapVisibility } from '@/lib/map/visibility';
import { cx } from '@/components/common/cx';
import styles from './Map.module.css';

interface MapLabelsProps {
  index: WorldIndex;
  visibility: MapVisibility;
  selectedId: string | null;
  /** Ids from the top of the hierarchy down to the selection. */
  selectedChain: ReadonlySet<string>;
}

/**
 * Country and region names. Purely visual (pointer-events are off in CSS), so
 * they never get in the way of clicking the shapes underneath.
 */
export const MapLabels = memo(function MapLabels({ index, visibility, selectedId, selectedChain }: MapLabelsProps) {
  return (
    <g className={styles.labels} aria-hidden="true">
      {index.countries().map((country) => {
        // Once a country is the context, its regions carry the names instead.
        if (country.id === visibility.countryId) return null;
        const [x, y] = index.labelPointOf(country.id);
        return (
          <text key={country.id} x={x} y={y} className={cx(styles.labelCountry, selectedId && styles.labelFaded)}>
            {country.name}
          </text>
        );
      })}

      {visibility.regionIds.map((id) => {
        // The selected region (or the one containing the selected city) is named by the panel and its markers.
        if (selectedChain.has(id)) return null;
        const [x, y] = index.labelPointOf(id);
        return (
          <text key={id} x={x} y={y} className={styles.labelRegion}>
            {index.require(id).name}
          </text>
        );
      })}
    </g>
  );
});
