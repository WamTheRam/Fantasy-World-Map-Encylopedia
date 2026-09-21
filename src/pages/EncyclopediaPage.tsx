import { useEffect, useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { cx } from '@/components/common/cx';
import { NewEntityButton } from '@/components/editor/EditButton';
import { EntityArticle } from '@/components/encyclopedia/EntityArticle';
import { Crumbs } from '@/components/navigation/Breadcrumbs';
import { TopBar } from '@/components/navigation/TopBar';
import styles from '@/components/encyclopedia/Encyclopedia.module.css';
import { useWorld } from '@/context/WorldContext';
import type { Category } from '@/lib/content/categories';
import { entityPath } from '@/lib/routing/entityPaths';
import { isLore } from '@/types/world';
import { NotFoundPage } from './NotFoundPage';

/** One section of the encyclopedia (People, Factions, Pantheon...): a list of entries and the selected article. */
export function EncyclopediaPage({ category }: { category: Category }) {
  const index = useWorld();
  const { entityId } = useParams();
  const entries = useMemo(() => index.loreOfType(category.type), [index, category]);
  const entity = entityId ? index.entity(entityId) : undefined;

  useEffect(() => {
    document.title = `${entity ? `${entity.name} · ` : ''}${category.label} · ${index.world.name}`;
  }, [entity, category, index.world.name]);

  if (entityId && !entity) {
    return <NotFoundPage heading="No such entry" message={`Nothing in ${index.world.name} has the id "${entityId}".`} />;
  }
  // A link into the wrong section (or a place) is sent to wherever that entity really lives.
  if (entity && !(isLore(entity) && entity.type === category.type)) {
    return <Navigate to={entityPath(index, entity.id)} replace />;
  }

  return (
    <div className={styles.page}>
      <TopBar>
        <Crumbs items={[{ label: category.label, to: `/${category.id}` }, ...(entity ? [{ label: entity.name }] : [])]} />
      </TopBar>

      <div className={styles.layout} data-selected={entity ? 'true' : 'false'}>
        <nav className={styles.list} aria-label={category.label}>
          <div className={styles.listHeader}>
            <h1 className={styles.listTitle}>{category.label}</h1>
            <p className={styles.blurb}>{category.blurb}</p>
            <NewEntityButton kind={category.type} label={`New ${category.singular.toLowerCase()}`} />
          </div>
          {entries.length === 0 ? (
            <p className={styles.emptyList}>
              Nothing here yet. Add a JSON file with <code>"type": "{category.type}"</code> under <code>src/data/entities/</code>. The README explains how.
            </p>
          ) : (
            <ul className={styles.entries}>
              {entries.map((entry) => (
                <li key={entry.id}>
                  <Link to={`/${category.id}/${entry.id}`} className={cx(styles.entry, entry.id === entityId && styles.entryActive)}>
                    <span className={styles.entryName}>{entry.name}</span>
                    {entry.summary && <span className={styles.entrySnippet}>{index.links.plain(entry.summary)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <main className={styles.reading}>
          {entity ? (
            <>
              <Link to={`/${category.id}`} className={styles.backToList}>
                ‹ All {category.label.toLowerCase()}
              </Link>
              <EntityArticle key={entity.id} entity={entity} />
            </>
          ) : (
            <p className={styles.placeholder}>Choose an entry to read about it.</p>
          )}
        </main>
      </div>
    </div>
  );
}
