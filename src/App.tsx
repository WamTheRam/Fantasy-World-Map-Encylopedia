import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DataProblems, DataWarnings } from '@/components/common/DataProblems';
import { WorldProvider } from '@/context/WorldContext';
import { worldLoad } from '@/lib/content/loadWorld';
import { CATEGORIES } from '@/lib/content/categories';
import { AtlasPage } from '@/pages/AtlasPage';
import { EncyclopediaPage } from '@/pages/EncyclopediaPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** Dev-only: shows a note after a save, and opens a newly created entry. Not part of production builds. */
const FlashToast = import.meta.env.DEV ? lazy(() => import('@/components/editor/FlashToast')) : null;

// Vite's BASE_URL ends in "/", but React Router wants no trailing slash on a sub-path.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export default function App() {
  if (!worldLoad.index) return <DataProblems issues={worldLoad.issues} />;

  return (
    <WorldProvider index={worldLoad.index}>
      <BrowserRouter basename={basename}>
        {FlashToast && (
          <Suspense fallback={null}>
            <FlashToast />
          </Suspense>
        )}
        <Routes>
          <Route path="/" element={<Navigate to="/atlas" replace />} />
          <Route path="/atlas/*" element={<AtlasPage />} />
          {CATEGORIES.map((category) => (
            <Route key={category.id} path={`/${category.id}/:entityId?`} element={<EncyclopediaPage key={category.id} category={category} />} />
          ))}
          <Route path="/history/:entityId?" element={<HistoryPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      {import.meta.env.DEV && <DataWarnings issues={worldLoad.issues} />}
    </WorldProvider>
  );
}
