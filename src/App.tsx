import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { WorldShell } from '@/components/navigation/WorldShell';
import { HomePage } from '@/pages/HomePage';

// Vite's BASE_URL ends in "/", but React Router wants no trailing slash on a sub-path.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

/**
 * Home (`/`) lists every world on this device and is always reachable, independently of whether
 * any world's data is valid. Everything else is delegated to `WorldShell`, which resolves the
 * currently open world (or sends the person back to Home if none is open) before rendering the
 * atlas/encyclopedia/history routes.
 */
export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/*" element={<WorldShell />} />
      </Routes>
    </BrowserRouter>
  );
}
