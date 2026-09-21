import { Link } from 'react-router-dom';
import { useWorld } from '@/context/WorldContext';
import { atlasPath } from '@/lib/routing/atlasPaths';
import type { AtlasLocation } from '@/types/world';
import styles from './Navigation.module.css';

export interface Crumb {
  label: string;
  /** Omit for plain text. The last crumb is always the current page. */
  to?: string;
}

/** A breadcrumb trail. Every crumb before the last navigates back up. */
export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol>
        {items.map((crumb, i) => {
          const current = i === items.length - 1;
          return (
            <li key={`${i}-${crumb.label}`}>
              {crumb.to ? (
                <Link to={crumb.to} aria-current={current ? 'page' : undefined}>
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={current ? 'page' : undefined}>{crumb.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** "World > Kingdom of Valen > Central Plains > Aurelia" for the atlas. */
export function Breadcrumbs({ trail }: { trail: AtlasLocation[] }) {
  const index = useWorld();
  return (
    <Crumbs
      items={[
        { label: 'World', to: atlasPath(index, null) },
        ...trail.map((location) => ({ label: location.name, to: atlasPath(index, location.id) })),
      ]}
    />
  );
}
