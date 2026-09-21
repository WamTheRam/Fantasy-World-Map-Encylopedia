/**
 * The one place where Vite's file-globbing meets the data folders.
 *
 *   src/data/locations/**.json   places (countries, regions, cities, points of interest)
 *   src/data/entities/**.json    people, factions, organizations, deities, politics, culture
 *   src/data/history/**.json     historical events
 *   src/content/**.md            long-form Markdown, matched to an entity by file name (aurelia.md -> "aurelia")
 *
 * Any file in any subfolder is picked up: folder names are only for your own
 * tidiness. What a file *is* comes from its `"type"` field. Adding an entry
 * never requires touching application code.
 */
import worldJson from '@/data/world.json';
import { buildWorld } from './buildWorld';
import type { RawFile, RawMarkdown } from './validateWorld';

const dataModules = import.meta.glob('/src/data/{locations,entities,history}/**/*.json', { eager: true, import: 'default' });
const contentModules = import.meta.glob<string>('/src/content/**/*.md', { eager: true, query: '?raw', import: 'default' });

const files: RawFile[] = Object.entries(dataModules).map(([path, data]) => ({
  path: path.replace(/^\//, ''),
  data,
}));

const markdown: RawMarkdown[] = Object.entries(contentModules).map(([path, text]) => ({
  path: path.replace(/^\//, ''),
  id: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''),
  text,
}));

export const worldLoad = buildWorld(worldJson, files, markdown);
