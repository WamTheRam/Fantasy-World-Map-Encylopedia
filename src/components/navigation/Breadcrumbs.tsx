import { Link } from 'react-router-dom';
import { useWorld } from '@/context/WorldContext';
import { atlasPath } from '@/lib/routing/atlasPaths';
import type { AtlasLocation } from '@/types/world';
import styles from './Navigation.module.css';

/** "World > Kingdom of Valen > Central Plains > Aurelia". Every earlier crumb navigates back up the hierarchy. */
export function Breadcrumbs({ trail }: { trail: AtlasLocation[] }) {
  const index = useWorld();
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol>
        <li>
          <Link to={atlasPath(index, null)} aria-current={trail.length === 0 ? 'page' : undefined}>
            World
          </Link>
        </li>
        {trail.map((location, i) => (
          <li key={location.id}>
            <Link to={atlasPath(index, location.id)} aria-current={i === trail.length - 1 ? 'page' : undefined}>
              {location.name}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
