import { IconChip, iconFor, typeLabel } from '@/components/map/locationIcons';
import { useWorld } from '@/context/WorldContext';
import { regionFill } from '@/lib/map/theme';
import { isPoint, type AtlasLocation } from '@/types/world';
import styles from './Sidebar.module.css';

interface LocationListProps {
  items: AtlasLocation[];
  onSelect: (id: string) => void;
}

/** A clickable list of places: regions with a colour swatch, cities and points with their map icon. */
export function LocationList({ items, onSelect }: LocationListProps) {
  const index = useWorld();
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const placeCount = isPoint(item) ? 0 : index.descendantsOf(item.id).filter(isPoint).length;
        return (
          <li key={item.id}>
            <button type="button" className={styles.listItem} onClick={() => onSelect(item.id)}>
              <span className={styles.listLead}>
                {isPoint(item) ? (
                  <IconChip icon={iconFor(item)} />
                ) : (
                  <span className={styles.swatch} style={{ background: regionFill(index, item) }} />
                )}
              </span>
              <span className={styles.listText}>
                <span className={styles.listName}>{item.name}</span>
                <span className={styles.listMeta}>
                  {isPoint(item) ? typeLabel(item) : `${placeCount} ${placeCount === 1 ? 'place' : 'places'}`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
