import { categoryOfType } from '@/lib/content/categories';
import type { WorldIndex } from '@/lib/content/worldIndex';
import { isEvent, isLocationEntity } from '@/types/world';
import { atlasPath } from './atlasPaths';

/**
 * The URL of any entity, decided from its id and type. This is the single place
 * that knows where things live, so links never hard-code routes.
 *
 *   place    /atlas/kingdom-of-valen/central-plains/aurelia   (and the map flies there)
 *   event    /history/the-sundering
 *   other    /people/queen-elara-ii   /pantheon/veyr   /factions/house-valen ...
 */
export function entityPath(index: WorldIndex, id: string): string {
  const entity = index.requireEntity(id);
  if (isLocationEntity(entity)) return atlasPath(index, id);
  if (isEvent(entity)) return `/history/${id}`;
  return `/${categoryOfType(entity.type).id}/${id}`;
}
