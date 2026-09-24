import { EditButton } from '@/components/editor/EditButton';
import { Connections, EntityProse, LinkedFrom } from '@/components/content/EntityBody';
import { EntityImage } from '@/components/content/EntityImage';
import { EntityLink } from '@/components/content/EntityLink';
import { useWorld } from '@/context/WorldContext';
import { entityKindLabel } from '@/lib/content/labels';
import { isEvent, type Entity } from '@/types/world';
import styles from './Encyclopedia.module.css';

/** The full reading view of one entity: used for encyclopedia entries and historical events. */
export function EntityArticle({ entity }: { entity: Entity }) {
  const index = useWorld();
  const sameYear = isEvent(entity) ? index.events.filter((e) => e.year === entity.year && e.id !== entity.id) : [];

  return (
    <article className={styles.article}>
      <header className={styles.articleHeader}>
        <div>
          <p className={styles.kind}>
            {entityKindLabel(entity)}
            {isEvent(entity) && <span className={styles.year}>Year {entity.year}</span>}
          </p>
          <h1 className={styles.title}>{entity.name}</h1>
        </div>
        <EditButton entityId={entity.id} />
      </header>

      {sameYear.length > 0 && isEvent(entity) && (
        <p className={styles.sameYear}>
          Also in Year {entity.year}:{' '}
          {sameYear.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ', '}
              <EntityLink id={e.id} />
            </span>
          ))}
        </p>
      )}

      <EntityImage entity={entity} />
      <div className={styles.prose}>
        <EntityProse entity={entity} />
      </div>
      <Connections entity={entity} />
      <LinkedFrom entity={entity} />
    </article>
  );
}
