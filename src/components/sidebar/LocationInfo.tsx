import { CollapsibleSection } from '@/components/common/CollapsibleSection';
import { Connections, EntityProse, LinkedFrom } from '@/components/content/EntityBody';
import { EntityImage } from '@/components/content/EntityImage';
import { IconChip, iconFor, typeLabel } from '@/components/map/locationIcons';
import { useWorld } from '@/context/WorldContext';
import { countryFill, islandFill, regionFill } from '@/lib/map/theme';
import { isPoint, type AtlasLocation } from '@/types/world';
import { LocationList } from './LocationList';
import styles from './Sidebar.module.css';

interface LocationInfoProps {
  location: AtlasLocation;
  onNavigate: (id: string) => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The panel's content for any location: identity, where it is, overview, and what's inside it. */
export function LocationInfo({ location, onNavigate }: LocationInfoProps) {
  const index = useWorld();

  // Nearest parent first: "In Central Plains, Kingdom of Valen".
  const ancestors = [...index.ancestorsOf(location.id)].reverse();
  const children = index.childrenOf(location.id);
  const regions = children.filter((c) => c.type === 'region');
  const islands = children.filter((c) => c.type === 'island');
  const places = children.filter(isPoint);
  const siblings =
    isPoint(location) && location.parent ? index.childrenOf(location.parent).filter((s) => s.id !== location.id) : [];

  const allPlaces = index.descendantsOf(location.id).filter(isPoint);

  const swatch =
    location.type === 'country'
      ? countryFill(index, location)
      : location.type === 'region'
        ? regionFill(index, location)
        : location.type === 'island'
          ? islandFill(index, location)
          : null;

  return (
    <article className={styles.article}>
      <p className={styles.kind}>
        {isPoint(location) ? (
          <IconChip icon={iconFor(location)} size={20} />
        ) : (
          <span className={styles.swatch} style={{ background: swatch ?? undefined }} />
        )}
        {typeLabel(location)}
      </p>

      <h1 className={styles.title}>{location.name}</h1>

      {ancestors.length > 0 && (
        <p className={styles.where}>
          In{' '}
          {ancestors.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              <button type="button" className={styles.link} onClick={() => onNavigate(a.id)}>
                {a.name}
              </button>
            </span>
          ))}
        </p>
      )}

      {(regions.length > 0 || islands.length > 0 || allPlaces.length > 0) && !isPoint(location) && (
        <p className={styles.facts}>
          {regions.length > 0 && <span>{plural(regions.length, 'region', 'regions')}</span>}
          {islands.length > 0 && <span>{plural(islands.length, 'island', 'islands')}</span>}
          {allPlaces.length > 0 && <span>{plural(allPlaces.length, 'place', 'places')}</span>}
        </p>
      )}

      <EntityImage entity={location} />
      <div className={styles.prose}>
        <EntityProse entity={location} />
      </div>

      <Connections entity={location} />

      {regions.length > 0 && (
        <CollapsibleSection title="Regions" count={regions.length}>
          <LocationList items={regions} onSelect={onNavigate} />
        </CollapsibleSection>
      )}

      {islands.length > 0 && (
        <CollapsibleSection title="Islands" count={islands.length}>
          <LocationList items={islands} onSelect={onNavigate} />
        </CollapsibleSection>
      )}

      {places.length > 0 && (
        <CollapsibleSection title={location.type === 'city' ? 'Places of note' : 'Cities and places'} count={places.length}>
          <LocationList items={places} onSelect={onNavigate} />
        </CollapsibleSection>
      )}

      {siblings.length > 0 && (
        <CollapsibleSection
          title={`Elsewhere in ${index.require(location.parent!).name}`}
          count={siblings.length}
          defaultOpen={siblings.length <= 8}
        >
          <LocationList items={siblings} onSelect={onNavigate} />
        </CollapsibleSection>
      )}

      <LinkedFrom entity={location} />
    </article>
  );
}
