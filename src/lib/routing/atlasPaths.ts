import type { WorldIndex } from '@/lib/content/worldIndex';
import type { AtlasLocation } from '@/types/world';

export const ATLAS_ROOT = '/atlas';

/**
 * Canonical URL for a location, e.g. `/atlas/kingdom-of-valen/central-plains/aurelia`.
 * `null` is the world view.
 */
export function atlasPath(index: WorldIndex, id: string | null): string {
  if (!id) return ATLAS_ROOT;
  return `${ATLAS_ROOT}/${index.chainTo(id).map((l) => l.id).join('/')}`;
}

export type AtlasResolution =
  | { status: 'root' }
  | { status: 'found'; location: AtlasLocation }
  /** The id exists, but the URL isn't its canonical path (e.g. a short link). */
  | { status: 'redirect'; to: string }
  | { status: 'not-found'; requested: string };

/**
 * Interprets the part of the URL after `/atlas/`.
 *
 * Ids are globally unique, so the *last* segment identifies the place. That
 * means short links like `/atlas/aurelia` work and are redirected to the full
 * canonical path.
 */
export function resolveAtlasPath(index: WorldIndex, splat: string | undefined): AtlasResolution {
  const segments = (splat ?? '').split('/').filter(Boolean);
  if (segments.length === 0) return { status: 'root' };

  const last = segments[segments.length - 1];
  const location = index.get(last);
  if (!location) return { status: 'not-found', requested: last };

  const canonical = atlasPath(index, location.id);
  const requested = `${ATLAS_ROOT}/${segments.join('/')}`;
  return requested === canonical ? { status: 'found', location } : { status: 'redirect', to: canonical };
}
