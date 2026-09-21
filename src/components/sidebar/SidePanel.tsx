import { useEffect, useRef } from 'react';
import { UiIcon } from '@/components/common/UiIcon';
import { EditButton } from '@/components/editor/EditButton';
import { useWorld } from '@/context/WorldContext';
import type { AtlasLocation } from '@/types/world';
import { LocationInfo } from './LocationInfo';
import styles from './Sidebar.module.css';

interface SidePanelProps {
  location: AtlasLocation;
  /** Navigate to a location, or to the world view when `null`. */
  onNavigate: (id: string | null) => void;
  /** Hide the panel without changing the selection. */
  onCollapse: () => void;
}

/** The information drawer. On wide screens it sits beside the map; on narrow ones it becomes a sheet below it. */
export function SidePanel({ location, onNavigate, onCollapse }: SidePanelProps) {
  const index = useWorld();
  const scrollRef = useRef<HTMLDivElement>(null);
  const parent = location.parent ? index.require(location.parent) : null;

  // Start each new place at the top of the panel.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [location.id]);

  return (
    <aside className={styles.panel} aria-label={`About ${location.name}`}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => onNavigate(parent?.id ?? null)}>
          <UiIcon name="chevronLeft" size={18} />
          {parent ? parent.name : 'World'}
        </button>
        <div className={styles.headerActions}>
          <EditButton entityId={location.id} />
          <button type="button" className={styles.collapse} onClick={onCollapse} aria-label="Hide panel" title="Hide panel">
            <UiIcon name="chevronRight" size={20} />
          </button>
        </div>
      </header>
      <div ref={scrollRef} className={styles.scroll}>
        <LocationInfo key={location.id} location={location} onNavigate={onNavigate} />
      </div>
    </aside>
  );
}
