/**
 * Pure helpers for the dev-only trace tool.
 */
import type { WorldIndex } from '@/lib/content/worldIndex';
import { ALLOWED_PARENTS } from '@/lib/content/validateWorld';
import type { AtlasLocation, LocationType, Point } from '@/types/world';

export type TraceKind = LocationType;

/** "Hagen's Field" -> "hagens-field". Matches the id rules the validator enforces. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/['\u2019]/g, '') // apostrophes vanish rather than becoming hyphens
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The vertex nearest to `point`, if one lies within `radius` map units. */
export function nearestVertex(vertices: readonly Point[], point: Point, radius: number): Point | null {
  let best: Point | null = null;
  let bestDistance = radius;
  for (const vertex of vertices) {
    const distance = Math.hypot(vertex[0] - point[0], vertex[1] - point[1]);
    if (distance <= bestDistance) {
      best = vertex;
      bestDistance = distance;
    }
  }
  return best;
}

/** Whole numbers for pixel-sized maps; one decimal for small coordinate spaces. */
export function roundCoordinate(value: number, mapWidth: number): number {
  return mapWidth >= 200 ? Math.round(value) : Math.round(value * 10) / 10;
}

export interface ParentOption {
  id: string;
  label: string;
}

/** Locations the new thing may legally sit inside, labelled with where they are ("Central Plains, Kingdom of Valen"). */
export function parentOptions(index: WorldIndex, kind: TraceKind): ParentOption[] {
  const allowed = ALLOWED_PARENTS[kind];
  return index.locations
    .filter((l: AtlasLocation) => allowed.includes(l.type))
    .map((l) => {
      const trail = [...index.ancestorsOf(l.id)].reverse().map((a) => a.name);
      return { id: l.id, label: [l.name, ...trail].join(', ') };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** A sensible default parent: the deepest thing in the current selection's trail that's allowed for this kind. */
export function defaultParent(index: WorldIndex, kind: TraceKind, selectedId: string | null): string | null {
  if (!selectedId) return null;
  const allowed = ALLOWED_PARENTS[kind];
  const match = [...index.chainTo(selectedId)].reverse().find((l) => allowed.includes(l.type));
  return match?.id ?? null;
}
