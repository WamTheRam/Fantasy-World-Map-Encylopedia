import { useEffect, useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { NewEntityButton } from '@/components/editor/EditButton';
import { EntityArticle } from '@/components/encyclopedia/EntityArticle';
import { Timeline } from '@/components/history/Timeline';
import { Crumbs } from '@/components/navigation/Breadcrumbs';
import { TopBar } from '@/components/navigation/TopBar';
import styles from '@/components/history/History.module.css';
import { useWorld } from '@/context/WorldContext';
import { groupByYear } from '@/lib/content/timeline';
import { entityPath } from '@/lib/routing/entityPaths';
import { isEvent } from '@/types/world';
import { NotFoundPage } from './NotFoundPage';

/**
 * The history section: a horizontal timeline above, and the selected event's
 * article below. History is deliberately separate from the map: opening an
 * event doesn't move it.
 */
export function HistoryPage() {
  const index = useWorld();
  const { entityId } = useParams();
  const groups = useMemo(() => groupByYear(index.events), [index]);
  const entity = entityId ? index.entity(entityId) : undefined;

  useEffect(() => {
    document.title = `${entity ? `${entity.name} · ` : ''}History · ${index.world.name}`;
  }, [entity, index.world.name]);

  if (entityId && !entity) {
    return <NotFoundPage heading="No such event" message={`Nothing in ${index.world.name} has the id "${entityId}".`} />;
  }
  if (entity && !isEvent(entity)) return <Navigate to={entityPath(index, entity.id)} replace />;

  return (
    <div className={styles.page}>
      <TopBar>
        <Crumbs items={[{ label: 'History', to: '/history' }, ...(entity ? [{ label: entity.name }] : [])]} />
      </TopBar>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>History</h1>
          <p className={styles.blurb}>The ages of {index.world.name}, in order. Select a point to read about it.</p>
        </div>
        <NewEntityButton kind="event" label="Add event" />
      </header>

      {groups.length > 0 ? (
        <div className={styles.band}>
          <Timeline groups={groups} selectedId={entity?.id} />
        </div>
      ) : (
        <p className={styles.empty}>
          No events yet. Add a JSON file with <code>"type": "event"</code> and a <code>"year"</code> under <code>src/data/history/</code>. The README explains how.
        </p>
      )}

      <main className={styles.reading}>
        {entity ? <EntityArticle key={entity.id} entity={entity} /> : groups.length > 0 && <p className={styles.placeholder}>Choose an event on the timeline.</p>}
      </main>
    </div>
  );
}
