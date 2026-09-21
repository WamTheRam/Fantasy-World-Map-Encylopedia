/**
 * Turns raw JSON into typed data. It reports problems across *all* files at once
 * rather than stopping at the first bad file, and each message names the file and
 * says how to fix it. (Within one file, a broken id/name/type is reported first,
 * since the remaining checks depend on them.)
 */
import { pointInPolygon } from '@/lib/map/geometry';
import {
  LOCATION_ICONS,
  isArea,
  type AtlasLocation,
  type LocationType,
  type Point,
  type WorldConfig,
} from '@/types/world';

export interface ValidationIssue {
  /** Errors stop the app from loading; warnings are advisory. */
  severity: 'error' | 'warning';
  /** Path of the offending file, relative to `src/data/`. */
  file: string;
  message: string;
}

export interface RawFile {
  path: string;
  data: unknown;
}

export interface ValidationResult {
  world: WorldConfig | null;
  locations: AtlasLocation[];
  issues: ValidationIssue[];
}

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCATION_TYPES: readonly LocationType[] = ['country', 'region', 'city', 'poi'];

/** Which parent types each location type may have. Countries have no parent. */
export const ALLOWED_PARENTS: Record<LocationType, readonly LocationType[]> = {
  country: [],
  region: ['country'],
  city: ['region', 'country'],
  poi: ['country', 'region', 'city'],
};

const isOffMap = (x: number, y: number, map: { width: number; height: number }) =>
  x < 0 || y < 0 || x > map.width || y > map.height;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPointTuple = (v: unknown): v is Point => Array.isArray(v) && v.length === 2 && isNumber(v[0]) && isNumber(v[1]);
const isCoordinates = (v: unknown): v is { x: number; y: number } => isRecord(v) && isNumber(v.x) && isNumber(v.y);

export function validateWorld(worldRaw: unknown, files: RawFile[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const report = (severity: ValidationIssue['severity'], file: string, message: string) =>
    issues.push({ severity, file, message });

  const world = parseWorld(worldRaw, (m) => report('error', 'world.json', m));
  const map = world?.map ?? { width: Infinity, height: Infinity };

  // ---- parse each file on its own -----------------------------------------
  const fileOf = new Map<AtlasLocation, string>();
  const locations: AtlasLocation[] = [];
  const byId = new Map<string, AtlasLocation>();

  for (const file of files) {
    const location = parseLocation(file.data, (m) => report('error', file.path, m));
    if (!location) continue;

    const existing = byId.get(location.id);
    if (existing) {
      report(
        'error',
        file.path,
        `Duplicate id "${location.id}" (also used in ${fileOf.get(existing)}). Every id must be unique across the whole world.`,
      );
      continue;
    }
    byId.set(location.id, location);
    fileOf.set(location, file.path);
    locations.push(location);
  }

  // ---- relationships between files ---------------------------------------
  for (const location of locations) {
    const file = fileOf.get(location)!;

    const offMap = isArea(location)
      ? location.polygon.some(([x, y]) => isOffMap(x, y, map))
      : isOffMap(location.coordinates.x, location.coordinates.y, map);
    if (offMap) {
      report(
        'warning',
        file,
        `"${location.name}" has coordinates outside the map (0,0 to ${map.width},${map.height}). Part of it won't be visible.`,
      );
    }

    if (location.type === 'country') continue;

    const parent = location.parent ? byId.get(location.parent) : undefined;
    if (!parent) {
      report(
        'error',
        file,
        `"${location.id}" has parent "${location.parent}", but no location with that id exists. Check the spelling, or create the parent first.`,
      );
      continue;
    }

    const allowed = ALLOWED_PARENTS[location.type];
    if (!allowed.includes(parent.type)) {
      report(
        'error',
        file,
        `A ${location.type} can't sit inside a ${parent.type} ("${parent.id}"). Allowed parent types: ${allowed.join(', ')}.`,
      );
      continue;
    }

    // Advisory: is the marker actually drawn inside its parent's polygon?
    if (!isArea(location) && isArea(parent)) {
      const { x, y } = location.coordinates;
      if (!pointInPolygon([x, y], parent.polygon)) {
        report(
          'warning',
          file,
          `"${location.name}" at (${x}, ${y}) is outside the polygon of its parent "${parent.name}". It will still work, but the marker will look misplaced.`,
        );
      }
    }
  }

  return { world, locations, issues };
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

function parseLocation(raw: unknown, fail: (message: string) => void): AtlasLocation | null {
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

  const label = typeof raw.id === 'string' ? `"${raw.id}"` : 'this location';

  need(typeof raw.id === 'string' && ID_PATTERN.test(raw.id), 'Missing or invalid "id". Use lowercase letters, digits and hyphens only, e.g. "northern-march".');
  need(typeof raw.name === 'string' && raw.name.trim().length > 0, `${label} is missing a "name".`);
  need(
    typeof raw.type === 'string' && (LOCATION_TYPES as readonly string[]).includes(raw.type),
    `${label} has an invalid "type". Use one of: ${LOCATION_TYPES.join(', ')}.`,
  );
  if (!ok) return null;

  const type = raw.type as LocationType;
  const parent = raw.parent ?? null;

  if (type === 'country') {
    need(parent === null, `${label} is a country, so it must not have a "parent".`);
  } else {
    need(typeof parent === 'string', `${label} needs a "parent": the id of the ${ALLOWED_PARENTS[type].join(' or ')} it belongs to.`);
  }
  need(raw.summary === undefined || typeof raw.summary === 'string', `${label}: "summary" must be a string.`);

  if (type === 'country' || type === 'region') {
    const polygon = raw.polygon;
    need(
      Array.isArray(polygon) && polygon.length >= 3 && polygon.every(isPointTuple),
      `${label} needs a "polygon": at least 3 points, each written as [x, y].`,
    );
    need(raw.color === undefined || typeof raw.color === 'string', `${label}: "color" must be a CSS colour string such as "#a9b78a".`);
    need(raw.labelPosition === undefined || isCoordinates(raw.labelPosition), `${label}: "labelPosition" must look like { "x": 100, "y": 200 }.`);
  } else {
    need(isCoordinates(raw.coordinates), `${label} needs "coordinates": { "x": <number>, "y": <number> }.`);
    need(
      raw.icon === undefined || (LOCATION_ICONS as readonly string[]).includes(raw.icon as string),
      `${label} has an unknown icon "${String(raw.icon)}". Available icons: ${LOCATION_ICONS.join(', ')}.`,
    );
  }

  return ok ? ({ ...raw, parent } as unknown as AtlasLocation) : null;
}

