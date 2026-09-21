import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useWorld } from '@/context/WorldContext';
import { entityKindLabel } from '@/lib/content/labels';
import { entityPath } from '@/lib/routing/entityPaths';
import styles from './Content.module.css';

interface EntityLinkProps {
  id: string;
  /** Wording to show. Defaults to the entity's name. */
  children?: ReactNode;
}

/**
 * A link to any entity, by id. The route comes from `entityPath`, so this is
 * the only thing components need to link anywhere: places open on the map
 * (which flies there), everything else opens its own page.
 */
export function EntityLink({ id, children }: EntityLinkProps) {
  const index = useWorld();
  const entity = index.entity(id);

  if (!entity) {
    return (
      <span className={styles.brokenLink} title={`No entity has the id "${id}"`}>
        {children ?? id}
      </span>
    );
  }
  return (
    <Link to={entityPath(index, id)} className={styles.entityLink} title={`${entityKindLabel(entity)}: ${entity.name}`}>
      {children ?? entity.name}
    </Link>
  );
}
