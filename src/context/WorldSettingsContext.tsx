import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_BACKGROUND, getWorldSummary, updateWorldBackground } from '@/lib/worlds/worldStore';

interface WorldSettingsValue {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
}

const WorldSettingsContext = createContext<WorldSettingsValue | null>(null);

/**
 * Holds the current world's editable settings and persists changes to `worldStore` as they're
 * made, so a reload picks up exactly where the person left off. One provider per open world
 * (`WorldShell` mounts a fresh one whenever `worldId` changes).
 */
export function WorldSettingsProvider({ worldId, children }: { worldId: string; children: ReactNode }) {
  const [backgroundColor, setBackgroundColorState] = useState(() => getWorldSummary(worldId)?.backgroundColor ?? DEFAULT_BACKGROUND);

  const setBackgroundColor = useCallback(
    (color: string) => {
      setBackgroundColorState(color);
      updateWorldBackground(worldId, color);
    },
    [worldId],
  );

  const value = useMemo<WorldSettingsValue>(() => ({ backgroundColor, setBackgroundColor }), [backgroundColor, setBackgroundColor]);

  return <WorldSettingsContext.Provider value={value}>{children}</WorldSettingsContext.Provider>;
}

/** Access and change the currently open world's settings. */
export function useWorldSettings(): WorldSettingsValue {
  const value = useContext(WorldSettingsContext);
  if (!value) throw new Error('useWorldSettings must be used inside <WorldSettingsProvider>');
  return value;
}
