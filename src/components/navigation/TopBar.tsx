import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useWorld } from '@/context/WorldContext';
import { MainMenu } from './MainMenu';
import styles from './Navigation.module.css';

/** Floating header over the map: menu, world name, and whatever page-specific content is passed in (e.g. breadcrumbs). */
export function TopBar({ children }: { children?: ReactNode }) {
  const { world } = useWorld();
  return (
    <header className={styles.topbar}>
      <div className={styles.pill}>
        <MainMenu />
        <Link to="/atlas" className={styles.brand}>
          {world.name}
        </Link>
      </div>
      {children}
    </header>
  );
}
