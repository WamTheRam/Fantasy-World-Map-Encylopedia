import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { UiIcon } from '@/components/common/UiIcon';
import { MapCanvas } from '@/components/map/MapCanvas';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { TopBar } from '@/components/navigation/TopBar';
import { SidePanel } from '@/components/sidebar/SidePanel';
import { useWorld } from '@/context/WorldContext';
import { atlasPath, resolveAtlasPath } from '@/lib/routing/atlasPaths';
import { entityPath } from '@/lib/routing/entityPaths';
import { NotFoundPage } from './NotFoundPage';
import styles from './Pages.module.css';

/**
 * The map-first landing page. The URL decides what is selected
 * (`/atlas/<country>/<region>/<city>`); the map and panel simply reflect it.
 * That makes every place directly linkable and the back button work naturally.
 */
export function AtlasPage() {
  const index = useWorld();
  const navigate = useNavigate();
  const splat = useParams()['*'];
  const resolution = resolveAtlasPath(index, splat);
  const selected = resolution.status === 'found' ? resolution.location : null;

  // Remember *which* selection had its panel hidden, so choosing anything else reopens it.
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);
  const panelHidden = selected !== null && hiddenFor === selected.id;

  const goTo = useCallback((id: string | null) => navigate(atlasPath(index, id)), [index, navigate]);

  // Escape steps back one level, unless something else (like the menu) already used the key.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]')) goTo(selected.parent);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, goTo]);

  useEffect(() => {
    document.title = selected ? `${selected.name} · ${index.world.name}` : `${index.world.name} Atlas`;
  }, [selected, index.world.name]);

  if (resolution.status === 'redirect') return <Navigate to={resolution.to} replace />;
  if (resolution.status === 'not-found') {
    // An id that belongs to something other than a place (/atlas/veyr) is sent to its own page.
    if (index.entity(resolution.requested)) return <Navigate to={entityPath(index, resolution.requested)} replace />;
    return (
      <NotFoundPage
        heading="That place isn't on the map"
        message={`Nothing in ${index.world.name} has the id "${resolution.requested}". Check the address, or start from the world map.`}
      />
    );
  }

  const trail = selected ? index.chainTo(selected.id) : [];

  return (
    <div className={styles.atlas}>
      <div className={styles.mapArea}>
        <MapCanvas index={index} selectedId={selected?.id ?? null} onSelect={goTo} />
        <TopBar>
          <Breadcrumbs trail={trail} />
        </TopBar>
        {!selected && (
          <p className={styles.hint}>
            {index.countries().length === 0 ? 'This world has no map data yet' : 'Select a country to begin exploring'}
          </p>
        )}
        {selected && panelHidden && (
          <button type="button" className={styles.reopen} onClick={() => setHiddenFor(null)}>
            <UiIcon name="chevronLeft" size={18} />
            {selected.name}
          </button>
        )}
      </div>
      {selected && !panelHidden && (
        <SidePanel location={selected} onNavigate={goTo} onCollapse={() => setHiddenFor(selected.id)} />
      )}
    </div>
  );
}
