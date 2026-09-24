import type { Entity } from '@/types/world';
import styles from './Content.module.css';

/**
 * An entity's optional image, shown prominently at the top of its page. Renders
 * nothing (no placeholder) when the entity doesn't have one.
 */
export function EntityImage({ entity }: { entity: Entity }) {
  if (!entity.image) return null;
  return (
    <div className={styles.imageWrap}>
      <img src={`${import.meta.env.BASE_URL}${entity.image}`} alt={entity.name} className={styles.image} />
    </div>
  );
}
