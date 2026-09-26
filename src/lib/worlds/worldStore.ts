/**
 * Client-side "world management" layer.
 *
 * A world is "file-backed" when it has a real folder under `src/data/worlds/<id>` --
 * `loadWorld.ts` discovers these by globbing at build/dev-server start, and they behave
 * exactly like this app's original, single bundled world always did: validated up front,
 * and (in development only) editable through the Trace/Edit tools, which save by writing
 * back into that same folder.
 *
 * A world created from the Home page ("Create World") always gets a browser-only entry
 * here too -- its config and content live in `localStorage`, in the same shape `buildWorld`
 * already knows how to validate and index (`RawFile`/`RawMarkdown`). That's what makes it
 * show up and open instantly, and it's the *only* thing that happens in a production build,
 * which has no server to write files to. In development, `createWorld` additionally asks
 * the dev server to scaffold a matching folder (`POST /__atlas/world`); once that file lands,
 * Vite reloads the page on its own (it matches the same glob `loadWorld.ts` reads), and from
 * then on that id is file-backed too, same as the world it shipped with -- see
 * `isFileBackedWorldId` and `withFileBackedWorlds` below for how the two are reconciled.
 *
 * Every read/write goes through `storageGet`/`storageSet`/`storageRemove`, which fall back to
 * an in-memory map when `localStorage` isn't available (SSR, private browsing, unit tests).
 * That keeps this module safe to import and call from anywhere, including plain `.test.ts` files.
 */
import { buildWorld, type WorldLoadResult } from '@/lib/content/buildWorld';
import { worldLoads } from '@/lib/content/loadWorld';
import type { RawFile, RawMarkdown } from '@/lib/content/validateWorld';
import { slugify } from '@/lib/map/trace';
import type { WorldConfig } from '@/types/world';

export interface WorldSummary {
  id: string;
  name: string;
  /** Any CSS colour. Shown as the map/world background. */
  backgroundColor: string;
  /** `Date.now()` at creation. `0` for a world that was already file-backed when first seen. */
  createdAt: number;
  /** `file`: has a real folder on disk and is editable in dev. `local`: browser-only. */
  kind: 'file' | 'local';
}

export interface LocalWorldBundle {
  config: WorldConfig;
  files: RawFile[];
  markdown: RawMarkdown[];
}

export const DEFAULT_BACKGROUND = '#c9d6d1'; // matches --sea in styles/tokens.css

const WORLDS_KEY = 'atlas:worlds';
const HIDDEN_FILE_WORLDS_KEY = 'atlas:hiddenFileWorlds';
const ACTIVE_WORLD_KEY = 'atlas:activeWorldId';
const worldDataKey = (id: string): string => `atlas:world-data:${id}`;

export function isFileBackedWorldId(id: string): boolean {
  return id in worldLoads;
}

// ---------------------------------------------------------------------------
// storage: localStorage when it's available, an in-memory map otherwise
// ---------------------------------------------------------------------------

const memory = new Map<string, string>();

function storageGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem(key);
  } catch {
    // Reading localStorage can throw (e.g. Safari private browsing). Fall through.
  }
  return memory.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Quota exceeded or blocked: keep going in memory for this session.
  }
  memory.set(key, value);
}

function storageRemove(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
  } catch {
    // ignore
  }
  memory.delete(key);
}

// ---------------------------------------------------------------------------
// registry: the list shown on the Home page
// ---------------------------------------------------------------------------

function isWorldSummary(value: unknown): value is WorldSummary {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.backgroundColor === 'string' && typeof v.createdAt === 'number' && (v.kind === 'file' || v.kind === 'local');
}

function readRegistry(): WorldSummary[] {
  const raw = storageGet(WORLDS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // "bundled" was this key's kind before multiple file-backed worlds were possible;
    // migrate it to "file" on read so a registry saved by an older build keeps working.
    const migrated = parsed.map((v) => (v && typeof v === 'object' && (v as Record<string, unknown>).kind === 'bundled' ? { ...(v as Record<string, unknown>), kind: 'file' } : v));
    return migrated.filter(isWorldSummary);
  } catch {
    return [];
  }
}

function writeRegistry(list: WorldSummary[]): void {
  storageSet(WORLDS_KEY, JSON.stringify(list));
}

function readHiddenFileWorlds(): Set<string> {
  const raw = storageGet(HIDDEN_FILE_WORLDS_KEY);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function hideFileWorld(id: string): void {
  const hidden = readHiddenFileWorlds();
  hidden.add(id);
  storageSet(HIDDEN_FILE_WORLDS_KEY, JSON.stringify([...hidden]));
}

/**
 * Registers every file-backed world (discovered by `loadWorld.ts`) that isn't already known,
 * and promotes one from `local` to `file` if the dev server has just scaffolded its folder --
 * in both cases keeping whatever background colour (and, for a promotion, creation date) is
 * already on file. Skips a world that was explicitly deleted from Home (`hideFileWorld`):
 * its files stay on disk, but it won't reappear here on its own.
 */
function withFileBackedWorlds(list: WorldSummary[]): WorldSummary[] {
  const hidden = readHiddenFileWorlds();
  const next = [...list];
  let changed = false;
  for (const id of Object.keys(worldLoads)) {
    if (hidden.has(id)) continue;
    const index = next.findIndex((w) => w.id === id);
    if (index === -1) {
      next.push({ id, name: worldLoads[id].index?.world.name ?? id, backgroundColor: DEFAULT_BACKGROUND, createdAt: 0, kind: 'file' });
      changed = true;
    } else if (next[index].kind !== 'file') {
      next[index] = { ...next[index], kind: 'file' };
      changed = true;
    }
  }
  if (changed) writeRegistry(next);
  return next;
}

/** All worlds available on this device, file-backed first, then local worlds oldest first. */
export function listWorlds(): WorldSummary[] {
  const list = withFileBackedWorlds(readRegistry());
  return [...list].sort((a, b) => (a.kind === b.kind ? a.createdAt - b.createdAt : a.kind === 'file' ? -1 : 1));
}

export function getWorldSummary(id: string): WorldSummary | undefined {
  return listWorlds().find((w) => w.id === id);
}

function uniqueWorldId(name: string, taken: ReadonlySet<string>): string {
  const base = slugify(name) || 'world';
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Creates a new, empty world and registers it (browser-only; works everywhere, including a
 * production build). In development, also asks the dev server to give it a real folder on
 * disk, which makes it fully editable -- see the module doc comment above. Either way, the
 * new world is *not* made active; the caller decides when to open it.
 */
export async function createWorld(name: string): Promise<WorldSummary> {
  const displayName = name.trim() || 'Untitled world';
  const list = listWorlds();
  const id = uniqueWorldId(displayName, new Set(list.map((w) => w.id)));

  const summary: WorldSummary = {
    id,
    name: displayName,
    backgroundColor: DEFAULT_BACKGROUND,
    createdAt: Date.now(),
    kind: 'local',
  };
  const bundle: LocalWorldBundle = {
    config: { id, name: displayName, map: { width: 4000, height: 3000 } },
    files: [],
    markdown: [],
  };

  writeRegistry([...list, summary]);
  storageSet(worldDataKey(id), JSON.stringify(bundle));

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    try {
      await fetch(`${import.meta.env.BASE_URL}__atlas/world`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, name: displayName }),
      });
      // On success, Vite notices the new src/data/worlds/<id>/world.json (it matches
      // loadWorld.ts's glob) and reloads the page on its own; nothing else to do here.
    } catch {
      // No dev server reachable, or the request failed: the world still works, just as a
      // browser-only one, exactly as it would in a production build.
    }
  }

  return summary;
}

/**
 * Removes a world from this device's list and clears it as the active world if it was open.
 * For a browser-only world this deletes its content outright. A file-backed world's folder is
 * never touched (there's no safe way to undo a real file deletion from a UI click) -- it's
 * hidden from Home instead, via `hideFileWorld`, and its files remain exactly as they were.
 */
export function deleteWorld(id: string): void {
  writeRegistry(withFileBackedWorlds(readRegistry()).filter((w) => w.id !== id));
  storageRemove(worldDataKey(id));
  if (isFileBackedWorldId(id)) hideFileWorld(id);
  if (getActiveWorldId() === id) setActiveWorldId(null);
}

export function updateWorldBackground(id: string, backgroundColor: string): WorldSummary | undefined {
  const list = withFileBackedWorlds(readRegistry());
  const index = list.findIndex((w) => w.id === id);
  if (index === -1) return undefined;
  const updated: WorldSummary = { ...list[index], backgroundColor };
  const next = [...list];
  next[index] = updated;
  writeRegistry(next);
  return updated;
}

// ---------------------------------------------------------------------------
// content: what's actually loaded when a world is opened
// ---------------------------------------------------------------------------

export function getLocalWorldBundle(id: string): LocalWorldBundle | undefined {
  const raw = storageGet(worldDataKey(id));
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalWorldBundle> | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.config) return undefined;
    return { config: parsed.config, files: parsed.files ?? [], markdown: parsed.markdown ?? [] };
  } catch {
    return undefined;
  }
}

/** Builds (or reuses) the `WorldIndex` for a world id, whether it's file-backed or local. */
export function resolveWorldLoad(id: string): WorldLoadResult {
  if (id in worldLoads) return worldLoads[id];
  const bundle = getLocalWorldBundle(id);
  if (!bundle) {
    return { index: null, issues: [{ severity: 'error', file: id, message: `No world with id "${id}" was found on this device.` }] };
  }
  return buildWorld(bundle.config, bundle.files, bundle.markdown);
}

// ---------------------------------------------------------------------------
// which world is currently open
// ---------------------------------------------------------------------------

export function getActiveWorldId(): string | null {
  return storageGet(ACTIVE_WORLD_KEY);
}

export function setActiveWorldId(id: string | null): void {
  if (id) storageSet(ACTIVE_WORLD_KEY, id);
  else storageRemove(ACTIVE_WORLD_KEY);
}
