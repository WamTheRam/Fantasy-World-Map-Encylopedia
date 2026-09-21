import { WorldIndex } from './worldIndex';
import { validateWorld, type RawFile, type RawMarkdown, type ValidationIssue } from './validateWorld';

export interface WorldLoadResult {
  /** `null` when the data has errors. The app then shows the error screen instead. */
  index: WorldIndex | null;
  /** Errors and warnings together. */
  issues: ValidationIssue[];
}

/** Validates raw JSON and Markdown and, if they're sound, builds the lookup index. Pure, so it's easy to test. */
export function buildWorld(worldRaw: unknown, files: RawFile[], markdownFiles: RawMarkdown[] = []): WorldLoadResult {
  const { world, locations, lore, events, markdown, issues } = validateWorld(worldRaw, files, markdownFiles);
  const hasErrors = issues.some((i) => i.severity === 'error');
  if (hasErrors || !world) return { index: null, issues };
  return { index: new WorldIndex(world, locations, lore, events, markdown), issues };
}
