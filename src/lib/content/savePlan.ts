/**
 * The rules for saving edits to the world's files: which file a change goes to,
 * what is allowed to change, and what is refused. Pure functions with no file
 * access, so the dev server (which does the writing) stays thin and these rules
 * are unit-tested.
 *
 * The rule that matters most: creating and updating are different operations.
 *   create  refuses if the id is already in use anywhere, whatever it names
 *   update  refuses unless exactly one file defines the id, and it must be the
 *           same kind of thing
 * so a save can never silently replace some other entity, or create a second
 * entity with an id that already exists.
 *
 * Imports are relative (not "@/...") because the dev server loads this in Node.
 */
import { LOCATION_ICONS, LORE_TYPES, type EntityType, type Point, type Relation } from '../../types/world.ts';

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const LOCATION_FOLDERS: Partial<Record<EntityType, string>> = {
  country: 'countries',
  region: 'regions',
  island: 'islands',
  city: 'cities',
  poi: 'points-of-interest',
};

/** Folder (under src/data/entities/ and src/content/) for each encyclopedia type. */
const LORE_FOLDERS: Record<string, string> = {
  person: 'people',
  faction: 'factions',
  organization: 'organizations',
  deity: 'pantheon',
  politics: 'politics',
  culture: 'culture',
};

export const isPlaceKind = (kind: string) => kind in LOCATION_FOLDERS;
export const isKnownKind = (kind: string): kind is EntityType => isPlaceKind(kind) || (LORE_TYPES as readonly string[]).includes(kind) || kind === 'event';

/** Where a brand-new entity's JSON goes, relative to `src/`. */
export function defaultDataFile(kind: EntityType, id: string): string {
  if (kind === 'event') return `data/history/${id}.json`;
  const place = LOCATION_FOLDERS[kind];
  if (place) return `data/locations/${place}/${id}.json`;
  return `data/entities/${LORE_FOLDERS[kind]}/${id}.json`;
}

/** Where a new Markdown body goes, relative to `src/`. */
export function defaultContentFile(kind: EntityType, id: string): string {
  const folder = kind === 'event' ? 'history' : isPlaceKind(kind) ? 'locations' : LORE_FOLDERS[kind];
  return `content/${folder}/${id}.md`;
}

export interface ExistingEntry {
  /** Relative to `src/`. */
  file: string;
  type: string;
}

export type SavePlan = { ok: true; file: string } | { ok: false; status: number; error: string };

export function planSave(args: { mode: 'create' | 'update'; id: string; kind: string; existing: readonly ExistingEntry[] }): SavePlan {
  const { mode, id, kind, existing } = args;
  const fail = (status: number, error: string): SavePlan => ({ ok: false, status, error });

  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return fail(400, `"${id}" is not a valid id. Use lowercase letters, digits and hyphens.`);
  if (!isKnownKind(kind)) return fail(400, `Unknown kind "${kind}".`);

  if (mode === 'create') {
    if (existing.length > 0) {
      return fail(409, `The id "${id}" is already used by ${existing[0].file}. Ids are unique across the whole world. Pick another, or edit the existing one.`);
    }
    return { ok: true, file: defaultDataFile(kind, id) };
  }

  if (existing.length === 0) return fail(404, `Nothing has the id "${id}", so there is nothing to update.`);
  if (existing.length > 1) return fail(409, `The id "${id}" is defined in more than one file (${existing.map((e) => e.file).join(', ')}). Fix that first.`);
  if (existing[0].type !== kind) return fail(400, `"${id}" is a ${existing[0].type}, not a ${kind}. Refusing to change what kind of thing it is.`);
  return { ok: true, file: existing[0].file };
}

// ---------------------------------------------------------------------------
// What an edit may change
// ---------------------------------------------------------------------------

export function editableFields(kind: string): readonly string[] {
  const common = ['name', 'summary', 'relations', 'image'];
  if (kind === 'country' || kind === 'region' || kind === 'island') return [...common, 'color'];
  if (kind === 'city' || kind === 'poi') return [...common, 'icon'];
  if (kind === 'event') return [...common, 'year', 'order'];
  return common;
}

export function sanitizeRelations(input: unknown): Relation[] {
  if (!Array.isArray(input)) return [];
  const out: Relation[] = [];
  for (const row of input) {
    const label = typeof row?.label === 'string' ? row.label.trim() : '';
    const target = typeof row?.target === 'string' ? row.target.trim() : '';
    if (label && ID_PATTERN.test(target)) out.push({ label, target });
  }
  return out;
}

/** Returns a message if the edit is unacceptable, otherwise null. */
export function validateEdits(kind: string, fields: Record<string, unknown>): string | null {
  if ('name' in fields && (typeof fields.name !== 'string' || fields.name.trim() === '')) return 'A name is required.';
  if (kind === 'event' && 'year' in fields && !(typeof fields.year === 'number' && Number.isInteger(fields.year))) {
    return 'An event needs a whole-number year, such as 412.';
  }
  if ('order' in fields && fields.order !== null && typeof fields.order !== 'number') return '"order" must be a number.';
  if (typeof fields.icon === 'string' && fields.icon !== '' && !(LOCATION_ICONS as readonly string[]).includes(fields.icon)) {
    return `Unknown icon "${fields.icon}".`;
  }
  if ('image' in fields && fields.image !== null && typeof fields.image !== 'string') return '"image" must be a string path or null.';
  return null;
}

/**
 * Applies edited fields to an existing record (or starts a new one). Only the
 * fields listed by `editableFields` are touched, so geometry, parent, and any
 * hand-added keys survive an edit. Clearing a field removes its key.
 */
export function applyEdits(existing: Record<string, unknown> | null, kind: string, id: string, fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = existing ? { ...existing } : { id, type: kind };
  const required = new Set(['name', 'year']);

  for (const key of editableFields(kind)) {
    if (!(key in fields)) continue;
    let value: unknown = fields[key];
    if (key === 'relations') value = sanitizeRelations(value);
    if (typeof value === 'string') value = value.trim();

    const empty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    if (empty && !required.has(key)) delete out[key];
    else out[key] = value;
  }
  return out;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPointTuple = (v: unknown): v is Point => Array.isArray(v) && v.length === 2 && v.every(isFiniteNumber);
const isPolygon = (v: unknown): v is Point[] => Array.isArray(v) && v.length >= 3 && v.every(isPointTuple);
const isPolygons = (v: unknown): v is Point[][] => Array.isArray(v) && v.length >= 1 && v.every(isPolygon);
const isAreaKind = (kind: unknown) => kind === 'country' || kind === 'region' || kind === 'island';

/** Replaces only the shape of an existing place. Everything else about it is left exactly as it is. */
export function applyGeometry(existing: Record<string, unknown>, geometry: Record<string, unknown>): Record<string, unknown> {
  const out = { ...existing };
  if (isAreaKind(existing.type)) {
    const polygons = geometry.polygons;
    if (!isPolygons(polygons)) throw new Error('A location needs at least one outline ("polygons"), each with at least 3 points, each [x, y].');
    out.polygons = polygons;
  } else {
    const c = geometry.coordinates as { x?: unknown; y?: unknown } | undefined;
    if (!c || typeof c.x !== 'number' || typeof c.y !== 'number') throw new Error('A marker needs coordinates { "x": …, "y": … }.');
    out.coordinates = { x: c.x, y: c.y };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Islands: geometry that is shared with a parent country
// ---------------------------------------------------------------------------

const samePolygon = (a: Point[], b: Point[]) => a.length === b.length && a.every(([x, y], i) => x === b[i][0] && y === b[i][1]);

/**
 * An island's own outline(s) are also part of its parent country's territory, so the
 * country's `polygons` literally contains a copy of them (see README/TRACING.md). This
 * keeps that copy in sync: it removes whichever of `oldPolygons` are present in the
 * parent (by value, since ids aren't stored per-ring) and adds `newPolygons` in their
 * place.
 *
 * Creating an island: pass `oldPolygons: []`, so this simply appends.
 * Redrawing an island: pass its previous outline(s) as `oldPolygons`, so the stale copy
 * is swapped for the new one rather than left behind as an orphaned shape.
 * A ring that isn't found (the parent was hand-edited, or redrawn without it) is left
 * alone; the new ring is still added, so the two are back in sync going forward.
 */
export function syncIslandIntoParent(parentPolygons: readonly Point[][], oldPolygons: readonly Point[][], newPolygons: readonly Point[][]): Point[][] {
  const remaining = [...parentPolygons];
  for (const old of oldPolygons) {
    const index = remaining.findIndex((ring) => samePolygon(ring, old));
    if (index !== -1) remaining.splice(index, 1);
  }
  return [...remaining, ...newPolygons];
}
