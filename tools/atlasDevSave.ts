/**
 * Dev-only Vite plugin behind the trace tool's Save button, the Edit dialog, and
 * Home's "Create World".
 *
 *   POST /__atlas/save     shapes: create a place, or replace only the shape of one
 *   POST /__atlas/entity   information: name, summary, connections, Markdown, ...
 *   POST /__atlas/world    scaffolds a brand-new world's folder (Home's "Create World")
 *
 * All the rules (what may change, what is refused) live in `src/lib/content/savePlan.ts`,
 * which is unit-tested. This file only reads and writes files.
 *
 * Safety: it exists only while `npm run dev` runs (`apply: 'serve'`); it writes only
 * inside src/data/worlds/<worldId>, src/content/worlds/<worldId> and
 * public/images/worlds/<worldId>; every worldId and id must be a valid slug (ID_PATTERN),
 * so a request cannot reach any path outside those folders. /__atlas/save and
 * /__atlas/entity additionally refuse to touch a worldId that has no world.json on disk
 * yet -- only /__atlas/world may create that folder in the first place.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';
import { formatEntityJson } from '../src/lib/content/formatEntity.ts';
import {
  applyEdits,
  applyGeometry,
  defaultContentFile,
  ID_PATTERN,
  isPlaceKind,
  planSave,
  syncIslandIntoParent,
  validateEdits,
  type ExistingEntry,
} from '../src/lib/content/savePlan.ts';
import type { Point } from '../src/types/world.ts';

const DATA_DIRS = ['locations', 'entities', 'history'];
/** The only keys accepted when creating a place, so a request can't smuggle in others. */
const NEW_PLACE_KEYS = ['id', 'name', 'type', 'parent', 'color', 'icon', 'coordinates', 'labelPosition', 'summary', 'relations', 'polygons'];

async function walk(dir: string, extension: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // the folder doesn't exist yet
  }
  const nested = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name), extension) : e.name.endsWith(extension) ? [path.join(dir, e.name)] : [])));
  return nested.flat();
}

/** Every file under a world's src/data/worlds/<worldId> that defines each id, wherever the author has filed it. */
async function scanDefinitions(src: string, worldId: string): Promise<Map<string, ExistingEntry[]>> {
  const found = new Map<string, ExistingEntry[]>();
  const worldRoot = path.join(src, 'data', 'worlds', worldId);
  for (const dir of DATA_DIRS) {
    for (const file of await walk(path.join(worldRoot, dir), '.json')) {
      try {
        const { id, type } = JSON.parse(await readFile(file, 'utf8'));
        if (typeof id !== 'string') continue;
        const list = found.get(id) ?? [];
        list.push({ file: path.relative(src, file).split(path.sep).join('/'), type: String(type) });
        found.set(id, list);
      } catch {
        /* malformed files are the validator's job to report */
      }
    }
  }
  return found;
}

async function findMarkdown(src: string, worldId: string, id: string): Promise<string | null> {
  const files = await walk(path.join(src, 'content', 'worlds', worldId), '.md');
  return files.find((f) => path.basename(f) === `${id}.md`) ?? null;
}

/** Whether a world's own world.json exists yet -- i.e. whether it's safe to write into its folder. */
async function worldExists(src: string, worldId: string): Promise<boolean> {
  try {
    await readFile(path.join(src, 'data', 'worlds', worldId, 'world.json'), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function readBody(req: IncomingMessage, maxBytes = 2_000_000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new Error('Request body is too large.'));
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Body is not valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

const IMAGE_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-zA-Z0-9+/=]+)$/;

export function atlasDevSave(): Plugin {
  let src = path.join(process.cwd(), 'src');
  let publicDir = path.join(process.cwd(), 'public');

  const reply = (res: ServerResponse, status: number, body: object) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };

  const writeJson = async (file: string, data: Record<string, unknown>) => {
    const target = path.join(src, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, formatEntityJson(data), 'utf8');
  };

  const readJson = async (file: string): Promise<Record<string, unknown>> => JSON.parse(await readFile(path.join(src, file), 'utf8'));

  /** Rejects a request whose worldId isn't a valid slug with a world.json already on disk. */
  const requireWorld = async (res: ServerResponse, worldId: unknown): Promise<boolean> => {
    if (typeof worldId !== 'string' || !ID_PATTERN.test(worldId)) {
      reply(res, 400, { error: 'Invalid or missing worldId.' });
      return false;
    }
    if (!(await worldExists(src, worldId))) {
      reply(res, 404, { error: `No world "${worldId}" was found on disk. Reload Home and open it again.` });
      return false;
    }
    return true;
  };

  return {
    name: 'atlas-dev-save',
    apply: 'serve',
    configResolved(config) {
      src = path.join(config.root, 'src');
      publicDir = path.join(config.root, 'public');
    },
    configureServer(server) {
      // ---- a brand-new world's folder --------------------------------------------
      // Home's "Create World" always makes a browser-only (localStorage) world so it
      // works in production too; in dev it additionally calls this so the same world
      // becomes a real, editable one. See src/lib/worlds/worldStore.ts.
      server.middlewares.use('/__atlas/world', async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { error: 'Use POST.' });
        try {
          const { id, name } = (await readBody(req)) as { id: string; name: string };
          if (typeof id !== 'string' || !ID_PATTERN.test(id)) return reply(res, 400, { error: 'Invalid id.' });
          if (typeof name !== 'string' || !name.trim()) return reply(res, 400, { error: 'A name is required.' });
          if (await worldExists(src, id)) return reply(res, 409, { error: `A world "${id}" already exists on disk.` });

          const config = { id, name: name.trim(), map: { width: 4000, height: 3000 } };
          const target = path.join(src, 'data', 'worlds', id, 'world.json');
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
          return reply(res, 200, { path: `src/data/worlds/${id}/world.json` });
        } catch (error) {
          reply(res, 400, { error: error instanceof Error ? error.message : 'Bad request.' });
        }
      });

      // ---- shapes ---------------------------------------------------------------
      server.middlewares.use('/__atlas/save', async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { error: 'Use POST.' });
        try {
          const { mode, worldId, id, data, geometry } = (await readBody(req)) as {
            mode: 'create' | 'update';
            worldId: string;
            id: string;
            data?: Record<string, unknown>;
            geometry?: Record<string, unknown>;
          };
          if (!(await requireWorld(res, worldId))) return;
          const definitions = await scanDefinitions(src, worldId);
          const existing = definitions.get(id) ?? [];

          if (mode === 'create') {
            const kind = String(data?.type);
            if (!data || !isPlaceKind(kind) || data.id !== id) return reply(res, 400, { error: 'Only places are created here, and the body must match the id.' });
            const plan = planSave({ mode, worldId, id, kind, existing });
            if (!plan.ok) return reply(res, plan.status, { error: plan.error });

            // An island's outline is also part of its parent country's territory (see
            // TRACING.md), so find that parent's file *before* writing anything, and fail
            // cleanly if it's missing, rather than creating an island with nowhere to merge into.
            let parent: { file: string; data: Record<string, unknown> } | null = null;
            if (kind === 'island') {
              const parentId = typeof data.parent === 'string' ? data.parent : '';
              const parentEntries = definitions.get(parentId) ?? [];
              if (parentEntries.length !== 1 || parentEntries[0].type !== 'country') {
                return reply(res, 400, { error: `An island needs a parent country. "${parentId}" isn't exactly one country.` });
              }
              parent = { file: parentEntries[0].file, data: await readJson(parentEntries[0].file) };
            }

            const clean = Object.fromEntries(Object.entries(data).filter(([key]) => NEW_PLACE_KEYS.includes(key)));
            await writeJson(plan.file, clean);

            if (parent) {
              const parentPolygons = Array.isArray(parent.data.polygons) ? (parent.data.polygons as Point[][]) : [];
              const islandPolygons = Array.isArray(clean.polygons) ? (clean.polygons as Point[][]) : [];
              await writeJson(parent.file, { ...parent.data, polygons: syncIslandIntoParent(parentPolygons, [], islandPolygons) });
            }
            return reply(res, 200, { path: `src/${plan.file}`, created: true });
          }

          if (mode !== 'update' || !geometry) return reply(res, 400, { error: 'Expected mode "create" or "update" (with geometry).' });
          const kind = existing[0]?.type ?? '';
          const plan = planSave({ mode, worldId, id, kind: isPlaceKind(kind) ? kind : 'region', existing });
          if (!plan.ok) return reply(res, plan.status, { error: plan.error });
          if (!isPlaceKind(kind)) return reply(res, 400, { error: `"${id}" is not a place, so it has no shape.` });

          const before = await readJson(plan.file);
          await writeJson(plan.file, applyGeometry(before, geometry));

          // Redrawing an island: keep its parent country's territory in sync by swapping
          // the island's old outline(s) there for the new one(s). Best-effort: if the
          // parent can no longer be found (a hand-edited file), the shape still updates;
          // the world's validator will flag the resulting mismatch.
          if (kind === 'island' && typeof before.parent === 'string') {
            const parentEntries = definitions.get(before.parent) ?? [];
            if (parentEntries.length === 1 && parentEntries[0].type === 'country') {
              const parentData = await readJson(parentEntries[0].file);
              const parentPolygons = Array.isArray(parentData.polygons) ? (parentData.polygons as Point[][]) : [];
              const oldPolygons = Array.isArray(before.polygons) ? (before.polygons as Point[][]) : [];
              const newPolygons = Array.isArray(geometry.polygons) ? (geometry.polygons as Point[][]) : [];
              await writeJson(parentEntries[0].file, { ...parentData, polygons: syncIslandIntoParent(parentPolygons, oldPolygons, newPolygons) });
            }
          }

          return reply(res, 200, { path: `src/${plan.file}`, created: false });
        } catch (error) {
          reply(res, 400, { error: error instanceof Error ? error.message : 'Bad request.' });
        }
      });

      // ---- image upload -----------------------------------------------------------
      // Stores the file itself under public/images/worlds/<worldId>, rather than
      // embedding it as base64 in the entity's JSON. /__atlas/entity's "image" field
      // then just holds the resulting path (e.g. "images/worlds/argoyll/aurelion.jpg").
      server.middlewares.use('/__atlas/image', async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { error: 'Use POST.' });
        try {
          const { worldId, id, dataUrl } = (await readBody(req, 9_000_000)) as { worldId: string; id: string; dataUrl: string };
          if (!(await requireWorld(res, worldId))) return;
          if (typeof id !== 'string' || !ID_PATTERN.test(id)) return reply(res, 400, { error: 'Invalid id.' });
          if (typeof dataUrl !== 'string') return reply(res, 400, { error: 'Missing image data.' });

          const match = IMAGE_DATA_URL.exec(dataUrl);
          if (!match) return reply(res, 400, { error: 'Use a PNG, JPEG, WebP or GIF image.' });
          const [, mime, base64] = match;
          const buffer = Buffer.from(base64, 'base64');
          if (buffer.length > MAX_IMAGE_BYTES) return reply(res, 400, { error: 'Images must be 6 MB or smaller.' });

          const dir = path.join(publicDir, 'images', 'worlds', worldId);
          await mkdir(dir, { recursive: true });
          const ext = IMAGE_MIME_EXT[mime];
          const file = `${id}.${ext}`;
          // Clear out a previous image for this id under a different extension, so
          // replacing a PNG with a JPEG doesn't leave the old file behind as an orphan.
          for (const entry of await readdir(dir).catch(() => [] as string[])) {
            if (entry.startsWith(`${id}.`) && entry !== file) await unlink(path.join(dir, entry)).catch(() => {});
          }
          await writeFile(path.join(dir, file), buffer);
          return reply(res, 200, { path: `images/worlds/${worldId}/${file}` });
        } catch (error) {
          reply(res, 400, { error: error instanceof Error ? error.message : 'Bad request.' });
        }
      });

      // ---- information ----------------------------------------------------------
      server.middlewares.use('/__atlas/entity', async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { error: 'Use POST.' });
        try {
          const { mode, worldId, id, kind, fields, body } = (await readBody(req)) as {
            mode: 'create' | 'update';
            worldId: string;
            id: string;
            kind: string;
            fields: Record<string, unknown>;
            body?: string;
          };
          if (!(await requireWorld(res, worldId))) return;
          if (mode === 'create' && isPlaceKind(kind)) return reply(res, 400, { error: 'Places are created with the Trace tool, which also draws their shape.' });

          const existing = (await scanDefinitions(src, worldId)).get(id) ?? [];
          const plan = planSave({ mode, worldId, id, kind, existing });
          if (!plan.ok) return reply(res, plan.status, { error: plan.error });
          const problem = validateEdits(kind, fields ?? {});
          if (problem) return reply(res, 400, { error: problem });
          if (mode === 'create' && !fields?.name) return reply(res, 400, { error: 'A name is required.' });

          const written: string[] = [];
          const previous = mode === 'update' ? await readJson(plan.file) : null;
          await writeJson(plan.file, applyEdits(previous, kind, id, fields ?? {}));
          written.push(`src/${plan.file}`);

          // If the image was replaced or removed, delete the old file so it doesn't
          // linger as an orphan. Only ever touches paths this app itself wrote.
          const prevImage = typeof previous?.image === 'string' ? previous.image : null;
          const nextImage = 'image' in (fields ?? {}) ? (typeof fields.image === 'string' ? fields.image : null) : prevImage;
          if (prevImage && prevImage !== nextImage && prevImage.startsWith('images/') && !prevImage.includes('..')) {
            await unlink(path.join(publicDir, prevImage)).catch(() => {});
          }

          if (typeof body === 'string') {
            const current = await findMarkdown(src, worldId, id);
            if (body.trim() === '') {
              if (current) {
                await unlink(current);
                written.push(`removed ${path.relative(path.dirname(src), current).split(path.sep).join('/')}`);
              }
            } else {
              const target = current ?? path.join(src, defaultContentFile(worldId, kind as never, id));
              await mkdir(path.dirname(target), { recursive: true });
              await writeFile(target, `${body.replace(/\s+$/, '')}\n`, 'utf8');
              written.push(path.relative(path.dirname(src), target).split(path.sep).join('/'));
            }
          }
          return reply(res, 200, { files: written });
        } catch (error) {
          reply(res, 400, { error: error instanceof Error ? error.message : 'Bad request.' });
        }
      });
    },
  };
}
