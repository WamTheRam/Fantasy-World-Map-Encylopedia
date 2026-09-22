/**
 * Turns raw JSON and Markdown into typed data. It reports problems across *all*
 * files at once rather than stopping at the first bad file, and each message
 * names the file and says how to fix it. (Within one file, a broken id/name/type
 * is reported first, since the remaining checks depend on them.)
 *
 * Every id must be unique across the whole world, whatever kind of thing it
 * names. That is what lets a bare id in prose resolve to exactly one entity.
 */
import { pointInAnyPolygon } from '@/lib/map/geometry';
import {
  LOCATION_ICONS,
  LORE_TYPES,
  isArea,
  isLocationEntity,
  type AtlasLocation,
  type Entity,
  type HistoryEvent,
  type LocationType,
  type LoreEntity,
  type Point,
  type Relation,
  type WorldConfig,
} from '@/types/world';
import { explicitTargets } from './links';

export interface ValidationIssue {
  /** Errors stop the app from loading; warnings are advisory. */
  severity: 'error' | 'warning';
  /** Path of the offending file, e.g. `src/data/locations/cities/aurelia.json`. */
  file: string;
  message: string;
}

export interface RawFile {
  path: string;
  data: unknown;
}

/** A Markdown body. Its id is the file name without `.md`. */
export interface RawMarkdown {
  path: string;
  id: string;
  text: string;
}

export interface ValidationResult {
  world: WorldConfig | null;
  locations: AtlasLocation[];
  lore: LoreEntity[];
  events: HistoryEvent[];
  /** Markdown body by entity id (only for ids that exist). */
  markdown: Map<string, string>;
  issues: ValidationIssue[];
}

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCATION_TYPES: readonly LocationType[] = ['country', 'region', 'island', 'city', 'poi'];
const ALL_TYPES: readonly string[] = [...LOCATION_TYPES, ...LORE_TYPES, 'event'];

/** Which parent types each location type may have. Countries have no parent. Islands belong only to a country. */
export const ALLOWED_PARENTS: Record<LocationType, readonly LocationType[]> = {
  country: [],
  region: ['country'],
  island: ['country'],
  city: ['region', 'country'],
  poi: ['country', 'region', 'city'],
};

const isOffMap = (x: number, y: number, map: { width: number; height: number }) =>
  x < 0 || y < 0 || x > map.width || y > map.height;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPointTuple = (v: unknown): v is Point => Array.isArray(v) && v.length === 2 && isNumber(v[0]) && isNumber(v[1]);
const isPolygon = (v: unknown): v is Point[] => Array.isArray(v) && v.length >= 3 && v.every(isPointTuple);
const isCoordinates = (v: unknown): v is { x: number; y: number } => isRecord(v) && isNumber(v.x) && isNumber(v.y);
const samePolygon = (a: Point[], b: Point[]) => a.length === b.length && a.every(([x, y], i) => x === b[i][0] && y === b[i][1]);

export function validateWorld(worldRaw: unknown, files: RawFile[], markdownFiles: RawMarkdown[] = []): ValidationResult {
  const issues: ValidationIssue[] = [];
  const report = (severity: ValidationIssue['severity'], file: string, message: string) => issues.push({ severity, file, message });

  const world = parseWorld(worldRaw, (m) => report('error', 'src/data/world.json', m));
  const map = world?.map ?? { width: Infinity, height: Infinity };

  // ---- parse each file on its own -----------------------------------------
  const fileOf = new Map<Entity, string>();
  const byId = new Map<string, Entity>();
  const all: Entity[] = [];

  for (const file of files) {
    const entity = parseEntity(file.data, (m) => report('error', file.path, m));
    if (!entity) continue;

    const existing = byId.get(entity.id);
    if (existing) {
      report('error', file.path, `Duplicate id "${entity.id}" (also used in ${fileOf.get(existing)}). Every id must be unique across the whole world, whatever it names.`);
      continue;
    }
    byId.set(entity.id, entity);
    fileOf.set(entity, file.path);
    all.push(entity);
  }

  const locations = all.filter(isLocationEntity);
  const lore = all.filter((e): e is LoreEntity => (LORE_TYPES as readonly string[]).includes(e.type));
  const events = all.filter((e): e is HistoryEvent => e.type === 'event');

  // ---- Markdown bodies -------------------------------------------------------
  const markdown = new Map<string, string>();
  for (const md of markdownFiles) {
    if (!byId.has(md.id)) {
      report('warning', md.path, `No entity has the id "${md.id}", so this file isn't shown anywhere. Rename it to match an entity id, or create the entity.`);
    } else if (markdown.has(md.id)) {
      report('warning', md.path, `A second content file exists for "${md.id}". Only the first one is used.`);
    } else {
      markdown.set(md.id, md.text);
    }
  }

  // ---- relationships between files ---------------------------------------
  for (const entity of all) {
    const file = fileOf.get(entity)!;

    for (const relation of entity.relations ?? []) {
      if (!byId.has(relation.target)) {
        report('warning', file, `Relation "${relation.label}" points at "${relation.target}", but no entity has that id.`);
      }
    }
    for (const [where, text] of [[file, entity.summary], [`content of ${entity.id}`, markdown.get(entity.id)]] as const) {
      for (const id of explicitTargets(text ?? '')) {
        if (!byId.has(id)) report('warning', where, `The link [[${id}]] doesn't match any entity id.`);
      }
    }

    if (!isLocationEntity(entity)) continue;

    const offMap = isArea(entity)
      ? entity.polygons.some((polygon) => polygon.some(([x, y]) => isOffMap(x, y, map)))
      : isOffMap(entity.coordinates.x, entity.coordinates.y, map);
    if (offMap) {
      report('warning', file, `"${entity.name}" has coordinates outside the map (0,0 to ${map.width},${map.height}). Part of it won't be visible.`);
    }

    if (entity.type === 'country') continue;

    const parent = entity.parent ? byId.get(entity.parent) : undefined;
    if (!parent) {
      report('error', file, `"${entity.id}" has parent "${entity.parent}", but no location with that id exists. Check the spelling, or create the parent first.`);
      continue;
    }
    const allowed = ALLOWED_PARENTS[entity.type];
    if (!isLocationEntity(parent) || !allowed.includes(parent.type)) {
      report('error', file, `A ${entity.type} can't sit inside a ${parent.type} ("${parent.id}"). Allowed parent types: ${allowed.join(', ')}.`);
      continue;
    }
    if (!isArea(entity) && isArea(parent)) {
      const { x, y } = entity.coordinates;
      if (!pointInAnyPolygon([x, y], parent.polygons)) {
        report('warning', file, `"${entity.name}" at (${x}, ${y}) is outside the polygon of its parent "${parent.name}". It will still work, but the marker will look misplaced.`);
      }
    }

    if (entity.type === 'island' && isArea(parent)) {
      const missing = entity.polygons.filter((ring) => !parent.polygons.some((p) => samePolygon(p, ring)));
      if (missing.length > 0) {
        report(
          'warning',
          file,
          `"${entity.name}" is an island of "${parent.name}", but its outline isn't part of that country's "polygons". Re-add it with the Trace tool, or copy the island's polygon into the country's file, so the country's territory includes it.`,
        );
      }
    }
  }

  return { world, locations, lore, events, markdown, issues };
}

// ---------------------------------------------------------------------------

function parseWorld(raw: unknown, fail: (message: string) => void): WorldConfig | null {
  if (!isRecord(raw)) {
    fail('world.json must contain a JSON object.');
    return null;
  }
  let ok = true;
  const need = (condition: boolean, message: string) => {
    if (!condition) {
      fail(message);
      ok = false;
    }
  };

  need(typeof raw.id === 'string' && raw.id.length > 0, 'Missing "id" (a short slug for your world).');
  need(typeof raw.name === 'string' && raw.name.length > 0, 'Missing "name" (the title shown in the header).');
  const map = raw.map;
  need(
    isRecord(map) && isNumber(map.width) && isNumber(map.height) && map.width > 0 && map.height > 0,
    'Missing "map": { "width": <number>, "height": <number> }. These define the map coordinate space.',
  );
  if (isRecord(map) && map.referenceImage !== undefined) {
    const ref = map.referenceImage;
    need(isRecord(ref) && typeof ref.src === 'string', '"map.referenceImage" needs a "src" path, e.g. "reference/my-map.png".');
  }
  return ok ? (raw as unknown as WorldConfig) : null;
}

/** Parses a `relations` array. Returns `undefined` (after reporting) when it's malformed. */
function parseRelations(raw: unknown, label: string, fail: (m: string) => void): Relation[] | undefined | false {
  if (raw === undefined) return undefined;
  const valid =
    Array.isArray(raw) &&
    raw.every((r) => isRecord(r) && typeof r.label === 'string' && r.label.trim() !== '' && typeof r.target === 'string' && r.target !== '');
  if (!valid) {
    fail(`${label}: "relations" must be a list like [ { "label": "Ruler of", "target": "kingdom-of-valen" } ].`);
    return false;
  }
  return raw as Relation[];
}

function parseEntity(raw: unknown, fail: (message: string) => void): Entity | null {
  if (!isRecord(raw)) {
    fail('This file must contain a JSON object.');
    return null;
  }
  let ok = true;
  const need = (condition: boolean, message: string) => {
    if (!condition) {
      fail(message);
      ok = false;
    }
  };

  const label = typeof raw.id === 'string' ? `"${raw.id}"` : 'this entry';

  need(typeof raw.id === 'string' && ID_PATTERN.test(raw.id), 'Missing or invalid "id". Use lowercase letters, digits and hyphens only, e.g. "northern-march".');
  need(typeof raw.name === 'string' && raw.name.trim().length > 0, `${label} is missing a "name".`);
  need(typeof raw.type === 'string' && ALL_TYPES.includes(raw.type), `${label} has an invalid "type". Use one of: ${ALL_TYPES.join(', ')}.`);
  if (!ok) return null;

  need(raw.summary === undefined || typeof raw.summary === 'string', `${label}: "summary" must be a string.`);
  if (parseRelations(raw.relations, label, (m) => { fail(m); ok = false; }) === false) ok = false;

  const type = raw.type as string;

  if (type === 'event') {
    need(isNumber(raw.year) && Number.isInteger(raw.year), `${label} needs a whole-number "year", e.g. "year": 412. Several events may share a year.`);
    need(raw.order === undefined || isNumber(raw.order), `${label}: "order" must be a number (it only orders events within the same year).`);
    return ok ? (raw as unknown as HistoryEvent) : null;
  }

  if ((LORE_TYPES as readonly string[]).includes(type)) {
    return ok ? (raw as unknown as LoreEntity) : null;
  }

  // ---- places -----------------------------------------------------------
  const locationType = type as LocationType;
  const parent = raw.parent ?? null;
  if (locationType === 'country') {
    need(parent === null, `${label} is a country, so it must not have a "parent".`);
  } else {
    need(typeof parent === 'string', `${label} needs a "parent": the id of the ${ALLOWED_PARENTS[locationType].join(' or ')} it belongs to.`);
  }

  if (locationType === 'country' || locationType === 'region' || locationType === 'island') {
    const polygons = raw.polygons;
    need(
      Array.isArray(polygons) && polygons.length >= 1 && polygons.every(isPolygon),
      `${label} needs a "polygons": a list of one or more outlines, each with at least 3 points written as [x, y].`,
    );
    need(raw.color === undefined || typeof raw.color === 'string', `${label}: "color" must be a CSS colour string such as "#a9b78a".`);
    need(raw.labelPosition === undefined || isCoordinates(raw.labelPosition), `${label}: "labelPosition" must look like { "x": 100, "y": 200 }.`);
  } else {
    need(isCoordinates(raw.coordinates), `${label} needs "coordinates": { "x": <number>, "y": <number> }.`);
    need(raw.icon === undefined || (LOCATION_ICONS as readonly string[]).includes(raw.icon as string), `${label} has an unknown icon "${String(raw.icon)}". Available icons: ${LOCATION_ICONS.join(', ')}.`);
  }

  return ok ? ({ ...raw, parent } as unknown as AtlasLocation) : null;
}
