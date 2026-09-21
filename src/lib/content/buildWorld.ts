import { WorldIndex } from './worldIndex';
import { validateWorld, type RawFile, type ValidationIssue } from './validateWorld';

export interface WorldLoadResult {
  /** `null` when the data has errors. The app then shows the error screen instead. */
  index: WorldIndex | null;
  /** Errors and warnings together. */
  issues: ValidationIssue[];
}

/** Validates raw JSON and, if it's sound, builds the lookup index. Pure, so it's easy to test. */
export function buildWorld(worldRaw: unknown, files: RawFile[]): WorldLoadResult {
  const { world, locations, issues } = validateWorld(worldRaw, files);
  const hasErrors = issues.some((i) => i.severity === 'error');
  if (hasErrors || !world) return { index: null, issues };
  return { index: new WorldIndex(world, locations), issues };
}
