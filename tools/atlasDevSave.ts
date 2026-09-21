/**
 * Dev-only Vite plugin behind the trace tool's Save button and the Edit dialog.
 *
 *   POST /__atlas/save     shapes: create a place, or replace only the shape of one
 *   POST /__atlas/entity   information: name, summary, connections, Markdown, ...
 *
 * All the rules (what may change, what is refused) live in `src/lib/content/savePlan.ts`,
 * which is unit-tested. This file only reads and writes files.
 *
 * Safety: it exists only while `npm run dev` runs (`apply: 'serve'`); it writes
 * only inside src/data and src/content; folders come from a fixed list and ids
 * must be valid slugs, so a request cannot reach any other path.
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
  isPlaceKind,
  planSave,
  validateEdits,
  type ExistingEntry,
} from '../src/lib/content/savePlan.ts';

const DATA_DIRS = ['locations', 'entities', 'history'];
/** The only keys accepted when creating a place, so a request can't smuggle in others. */
const NEW_PLACE_KEYS = ['id', 'name', 'type', 'parent', 'color', 'icon', 'coordinates', 'labelPosition', 'summary', 'relations', 'polygon'];

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

/** Every file under src/data that defines each id, wherever the author has filed it. */
async function scanDefinitions(src: string): Promise<Map<string, ExistingEntry[]>> {
  const found = new Map<string, ExistingEntry[]>();
  for (const dir of DATA_DIRS) {
    for (const file of await walk(path.join(src, 'data', dir), '.json')) {
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

async function findMarkdown(src: string, id: string): Promise<string | null> {
  const files = await walk(path.join(src, 'content'), '.md');
  return files.find((f) => path.basename(f) === `${id}.md`) ?? null;
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Body is not valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

export function atlasDevSave(): Plugin {
  let src = path.join(process.cwd(), 'src');

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

  return {
    name: 'atlas-dev-save',
    apply: 'serve',
    configResolved(config) {
      src = path.join(config.root, 'src');
    },
    configureServer(server) {
      // ---- shapes ---------------------------------------------------------------
      server.middlewares.use('/__atlas/save', async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { error: 'Use POST.' });
        try {
          const { mode, id, data, geometry } = (await readBody(req)) as {
            mode: 'create' | 'update';
            id: string;
            data?: Record<string, unknown>;
            geometry?: Record<string, unknown>;
          };
          const existing = (await scanDefinitions(src)).get(id) ?? [];

          if (mode === 'create') {
            const kind = String(data?.type);
            if (!data || !isPlaceKind(kind) || data.id !== id) return reply(res, 400, { error: 'Only places are created here, and the body must match the id.' });
            const plan = planSave({ mode, id, kind, existing });
            if (!plan.ok) return reply(res, plan.status, { error: plan.error });
            const clean = Object.fromEntries(Object.entries(data).filter(([key]) => NEW_PLACE_KEYS.includes(key)));
            await writeJson(plan.file, clean);
            return reply(res, 200, { path: `src/${plan.file}`, created: true });
          }

          if (mode !== 'update' || !geometry) return reply(res, 400, { error: 'Expected mode "create" or "update" (with geometry).' });
          const kind = existing[0]?.type ?? '';
          const plan = planSave({ mode, id, kind: isPlaceKind(kind) ? kind : 'region', existing });
          if (!plan.ok) return reply(res, plan.status, { error: plan.error });
          if (!isPlaceKind(kind)) return reply(res, 400, { error: `"${id}" is not a place, so it has no shape.` });
          await writeJson(plan.file, applyGeometry(await readJson(plan.file), geometry));
          return reply(res, 200, { path: `src/${plan.file}`, created: false });
        } catch (error) {
          reply(res, 400, { error: error instanceof Error ? error.message : 'Bad request.' });
        }
      });

      // ---- information ----------------------------------------------------------
      server.middlewares.use('/__atlas/entity', async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { error: 'Use POST.' });
        try {
          const { mode, id, kind, fields, body } = (await readBody(req)) as {
            mode: 'create' | 'update';
            id: string;
            kind: string;
            fields: Record<string, unknown>;
            body?: string;
          };
          if (mode === 'create' && isPlaceKind(kind)) return reply(res, 400, { error: 'Places are created with the Trace tool, which also draws their shape.' });

          const existing = (await scanDefinitions(src)).get(id) ?? [];
          const plan = planSave({ mode, id, kind, existing });
          if (!plan.ok) return reply(res, plan.status, { error: plan.error });
          const problem = validateEdits(kind, fields ?? {});
          if (problem) return reply(res, 400, { error: problem });
          if (mode === 'create' && !fields?.name) return reply(res, 400, { error: 'A name is required.' });

          const written: string[] = [];
          const previous = mode === 'update' ? await readJson(plan.file) : null;
          await writeJson(plan.file, applyEdits(previous, kind, id, fields ?? {}));
          written.push(`src/${plan.file}`);

          if (typeof body === 'string') {
            const current = await findMarkdown(src, id);
            if (body.trim() === '') {
              if (current) {
                await unlink(current);
                written.push(`removed ${path.relative(path.dirname(src), current).split(path.sep).join('/')}`);
              }
            } else {
              const target = current ?? path.join(src, defaultContentFile(kind as never, id));
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
