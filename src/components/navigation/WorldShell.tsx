import { Suspense, lazy, useMemo, type CSSProperties, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DataProblems, DataWarnings } from '@/components/common/DataProblems';
import dataProblemsStyles from '@/components/common/DataProblems.module.css';
import { WorldProvider } from '@/context/WorldContext';
import { WorldSettingsProvider, useWorldSettings } from '@/context/WorldSettingsContext';
import { CATEGORIES } from '@/lib/content/categories';
import { getActiveWorldId, isFileBackedWorldId, resolveWorldLoad } from '@/lib/worlds/worldStore';
import { AtlasPage } from '@/pages/AtlasPage';
import { EncyclopediaPage } from '@/pages/EncyclopediaPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** Dev-only: shows a note after a save, and opens a newly created entry. Not part of production builds. */
const FlashToast = import.meta.env.DEV ? lazy(() => import('@/components/editor/FlashToast')) : null;

/** Mixes a hex colour with white, `amount` from 0 (unchanged) to 1 (white). Used to derive the
 *  pale "shore" halo colour from whatever sea colour the world picked, without depending on the
 *  browser re-resolving a `color-mix(var(...))` chain across a CSS custom-property override. */
function lighten(hex: string, amount: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex; // an unexpected format (e.g. a named colour): leave it as-is
  const channels = match[1].match(/../g)!.map((h) => parseInt(h, 16));
  const mixed = channels.map((c) => Math.round(c + (255 - c) * amount));
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Applies the open world's background colour as CSS variables the map (and anything else) can read. */
function WorldBackground({ children }: { children: ReactNode }) {
  const { backgroundColor } = useWorldSettings();
  const style = {
    height: '100%',
    '--sea': backgroundColor,
    '--sea-shallow': lighten(backgroundColor, 0.38),
  } as CSSProperties;
  return <div style={style}>{children}</div>;
}

/**
 * Resolves whichever world is currently open (`worldStore.getActiveWorldId`) and provides it to
 * the atlas/encyclopedia/history routes nested below. Reachable only once a world has been opened
 * from Home; otherwise it sends the person back there without touching any world's data.
 */
export function WorldShell() {
  const activeId = getActiveWorldId();
  const result = useMemo(() => (activeId ? resolveWorldLoad(activeId) : null), [activeId]);

  if (!activeId || !result) return <Navigate to="/" replace />;
  if (!result.index) return <DataProblems issues={result.issues} />;

  return (
    <WorldProvider index={result.index}>
      <WorldSettingsProvider worldId={activeId}>
        <WorldBackground>
          {FlashToast && (
            <Suspense fallback={null}>
              <FlashToast />
            </Suspense>
          )}
          <Routes>
            <Route path="/atlas/*" element={<AtlasPage />} />
            {CATEGORIES.map((category) => (
              <Route key={category.id} path={`/${category.id}/:entityId?`} element={<EncyclopediaPage key={category.id} category={category} />} />
            ))}
            <Route path="/history/:entityId?" element={<HistoryPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          {import.meta.env.DEV && !isFileBackedWorldId(activeId) && (
            <p className={dataProblemsStyles.banner} role="status">
              Editing tools (Edit, New, Trace) are hidden here: this world is browser-only. Creating a world normally gives it a real
              folder too, so it's odd to see this for one you just made — check the dev server's terminal output for errors.
            </p>
          )}
          {import.meta.env.DEV && <DataWarnings issues={result.issues} />}
        </WorldBackground>
      </WorldSettingsProvider>
    </WorldProvider>
  );
}
