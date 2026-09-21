/**
 * The one place where Vite's file-globbing meets the data folder.
 *
 * Every `.json` file anywhere under `src/data/locations/` is picked up
 * automatically: adding a country, region or city never requires touching
 * application code. Folder names are just for your own organisation. What a
 * file *is* is decided by its `"type"` field.
 */
import worldJson from '@/data/world.json';
import { buildWorld } from './buildWorld';
import type { RawFile } from './validateWorld';

const modules = import.meta.glob('/src/data/locations/**/*.json', { eager: true, import: 'default' });

const files: RawFile[] = Object.entries(modules).map(([path, data]) => ({
  path: path.replace('/src/data/', ''),
  data,
}));

export const worldLoad = buildWorld(worldJson, files);
