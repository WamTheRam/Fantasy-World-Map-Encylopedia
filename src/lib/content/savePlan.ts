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
import { LOCATION_ICONS, LORE_TYPES, type EntityType, type Relation } from '../../types/world.ts';

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const LOCATION_FOLDERS: Partial<Record<EntityType, string>> = {
  country: 'countries',
  region: 'regions',
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
  const common = ['name', 'summary', 'relations'];
  if (kind === 'country' || kind === 'region') return [...common, 'color'];
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

/** Replaces only the shape of an existing place. Everything else about it is left exactly as it is. */
export function applyGeometry(existing: Record<string, unknown>, geometry: Record<string, unknown>): Record<string, unknown> {
  const out = { ...existing };
  if (existing.type === 'country' || existing.type === 'region') {
    const polygon = geometry.polygon;
    const valid = Array.isArray(polygon) && polygon.length >= 3 && polygon.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n)));
    if (!valid) throw new Error('A polygon needs at least 3 points, each [x, y].');
    out.polygon = polygon;
  } else {
    const c = geometry.coordinates as { x?: unknown; y?: unknown } | undefined;
    if (!c || typeof c.x !== 'number' || typeof c.y !== 'number') throw new Error('A marker needs coordinates { "x": …, "y": … }.');
    out.coordinates = { x: c.x, y: c.y };
  }
  return out;
}
