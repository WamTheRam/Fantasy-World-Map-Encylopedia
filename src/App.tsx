import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DataProblems, DataWarnings } from '@/components/common/DataProblems';
import { WorldProvider } from '@/context/WorldContext';
import { worldLoad } from '@/lib/content/loadWorld';
import { AtlasPage } from '@/pages/AtlasPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Vite's BASE_URL ends in "/", but React Router wants no trailing slash on a sub-path.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export default function App() {
  if (!worldLoad.index) return <DataProblems issues={worldLoad.issues} />;

  return (
    <WorldProvider index={worldLoad.index}>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<Navigate to="/atlas" replace />} />
          <Route path="/atlas/*" element={<AtlasPage />} />
          {/* People, Factions, Pantheon, History, etc. get their routes here as they are built. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      {import.meta.env.DEV && <DataWarnings issues={worldLoad.issues} />}
    </WorldProvider>
  );
}
