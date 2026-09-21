import { createContext, useContext, type ReactNode } from 'react';
import type { WorldIndex } from '@/lib/content/worldIndex';

const WorldContext = createContext<WorldIndex | null>(null);

export function WorldProvider({ index, children }: { index: WorldIndex; children: ReactNode }) {
  return <WorldContext.Provider value={index}>{children}</WorldContext.Provider>;
}

/** Access the loaded world from any component. */
export function useWorld(): WorldIndex {
  const index = useContext(WorldContext);
  if (!index) throw new Error('useWorld must be used inside <WorldProvider>');
  return index;
}
