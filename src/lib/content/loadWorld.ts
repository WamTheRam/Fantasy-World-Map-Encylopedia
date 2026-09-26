/**
 * The one place where Vite's file-globbing meets the data folders.
 *
 *   src/data/worlds/<id>/world.json            the world's own config (name, map size, ...)
 *   src/data/worlds/<id>/locations/**.json     places (countries, regions, cities, points of interest)
 *   src/data/worlds/<id>/entities/**.json      people, factions, organizations, deities, politics, culture
 *   src/data/worlds/<id>/history/**.json       historical events
 *   src/content/worlds/<id>/**.md              long-form Markdown, matched to an entity by file name
 *                                               (aurelion.md -> "aurelion")
 *
 * A world is just a top-level folder name under src/data/worlds (and, for its Markdown, the
 * matching folder under src/content/worlds) -- there is no separate registration step, and
 * within a world any file in any subfolder is picked up (folder names below that are only for
 * your own tidiness). What a file *is* comes from its own "type" field.
 *
 * This is also what makes worlds created from the app's Home page real, editable worlds rather
 * than a special case: in development, worldStore.createWorld asks the dev server
 * (tools/atlasDevSave.ts, POST /__atlas/world) to scaffold exactly this shape, and the new
 * folder shows up here (Vite reloads automatically once a glob's file set changes), after which
 * it is loaded, edited and saved exactly like the world below.
 */
import type { WorldConfig } from '@/types/world';
import { buildWorld, type WorldLoadResult } from './buildWorld';
import type { RawFile, RawMarkdown } from './validateWorld';

const configModules = import.meta.glob<WorldConfig>('/src/data/worlds/*/world.json', { eager: true, import: 'default' });
const dataModules = import.meta.glob('/src/data/worlds/*/{locations,entities,history}/**/*.json', { eager: true, import: 'default' });
const contentModules = import.meta.glob<string>('/src/content/worlds/*/**/*.md', { eager: true, query: '?raw', import: 'default' });

/** Pulls the `<id>` segment out of a glob key like `/src/data/worlds/<id>/...`. */
function worldIdFromPath(path: string, root: 'data' | 'content'): string | null {
  const prefix = `/src/${root}/worlds/`;
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  const slash = rest.indexOf('/');
  return slash === -1 ? null : rest.slice(0, slash);
}

function groupByWorld<T>(modules: Record<string, unknown>, root: 'data' | 'content', toEntry: (path: string, value: unknown) => T): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const [path, value] of Object.entries(modules)) {
    const id = worldIdFromPath(path, root);
    if (!id) continue;
    const list = grouped.get(id) ?? [];
    list.push(toEntry(path, value));
    grouped.set(id, list);
  }
  return grouped;
}

const filesByWorld = groupByWorld<RawFile>(dataModules, 'data', (path, data) => ({ path: path.replace(/^\//, ''), data }));
const markdownByWorld = groupByWorld<RawMarkdown>(contentModules, 'content', (path, text) => ({
  path: path.replace(/^\//, ''),
  id: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''),
  text: text as string,
}));

/** Every world shipped with this build, or scaffolded on disk during this dev session, by id. */
export const worldLoads: Record<string, WorldLoadResult> = {};
for (const [path, config] of Object.entries(configModules)) {
  const id = worldIdFromPath(path, 'data');
  if (!id) continue;
  worldLoads[id] = buildWorld(config, filesByWorld.get(id) ?? [], markdownByWorld.get(id) ?? []);
}

/**
 * Back-compat single-world export for code written before multi-world support
 * (`worldData.test.ts`, `demoWorld.test.ts`, both of which specifically test this app's
 * original bundled world). Resolves to it by id rather than "whichever world loaded first",
 * so it stays correct once a second world is scaffolded during a dev session.
 */
export const worldLoad: WorldLoadResult = worldLoads.argoyll ??
  Object.values(worldLoads)[0] ?? {
    index: null,
    issues: [{ severity: 'error', file: 'data/worlds', message: 'No world was found under src/data/worlds/<id>/world.json.' }],
  };
