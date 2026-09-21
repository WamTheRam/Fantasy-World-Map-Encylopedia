/**
 * Dev-only Vite plugin behind the trace tool's Save button.
 *
 * It adds one endpoint, POST /__atlas/save, that writes a location's JSON file
 * into src/data/locations/. Vite then notices the new file and reloads the map.
 *
 * Safety: it only exists while `npm run dev` is running (`apply: 'serve'`), only
 * writes inside src/data/locations, only accepts known folder names, and only
 * accepts ids that are valid slugs, so a request can't reach any other path.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';
import { formatLocationJson } from '../src/lib/content/formatLocation';
import { mergeLocation } from '../src/lib/content/mergeLocation';

const FOLDERS = ['countries', 'regions', 'cities', 'points-of-interest'];
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Finds the file that already defines `id`, wherever the author has filed it. */
async function findExisting(dir: string, id: string): Promise<string | null> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null; // folder doesn't exist yet
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findExisting(full, id);
      if (found) return found;
    } else if (entry.name.endsWith('.json')) {
      try {
        if (JSON.parse(await readFile(full, 'utf8')).id === id) return full;
      } catch {
        /* unreadable or malformed files are the validator's job to report */
      }
    }
  }
  return null;
}

export function atlasDevSave(): Plugin {
  let root = process.cwd();

  return {
    name: 'atlas-dev-save',
    apply: 'serve',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use('/__atlas/save', (req, res) => {
        const reply = (status: number, body: object) => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });

        let raw = '';
        req.on('data', (chunk) => {
          raw += chunk;
          if (raw.length > 1_000_000) req.destroy();
        });
        req.on('end', async () => {
          try {
            const { folder, id, data } = JSON.parse(raw) as { folder: string; id: string; data: Record<string, unknown> };
            if (!FOLDERS.includes(folder)) return reply(400, { error: `Unknown folder "${folder}".` });
            if (typeof id !== 'string' || !ID_PATTERN.test(id)) return reply(400, { error: `"${id}" is not a valid id.` });
            if (!data || typeof data !== 'object' || data.id !== id) return reply(400, { error: 'Body does not match the id.' });

            const locationsDir = path.join(root, 'src', 'data', 'locations');
            const existing = await findExisting(locationsDir, id);
            const target = existing ?? path.join(locationsDir, folder, `${id}.json`);
            let previous: Record<string, unknown> | null = null;
            if (existing) {
              try {
                previous = JSON.parse(await readFile(existing, 'utf8'));
              } catch {
                /* unreadable: treat as new */
              }
            }
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, formatLocationJson(mergeLocation(previous, data)), 'utf8');
            reply(200, { path: path.relative(root, target).split(path.sep).join('/'), overwritten: existing !== null });
          } catch (error) {
            reply(400, { error: error instanceof Error ? error.message : 'Bad request.' });
          }
        });
      });
    },
  };
}
