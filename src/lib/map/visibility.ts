import type { WorldIndex } from '@/lib/content/worldIndex';
import { isPoint } from '@/types/world';

/**
 * Level-of-detail rules: what the map draws for a given selection.
 *
 *   nothing selected   countries only
 *   country selected   + that country's regions and islands
 *   region selected    + that region's cities and points of interest
 *   island selected    + that island's cities and points of interest
 *   city selected      same as its region (or island)
 *
 * Keeping these rules in one small function (rather than scattered through
 * components) makes the behaviour easy to see and to change.
 */
export interface MapVisibility {
  /** Country whose regions (and islands) are drawn, if any. */
  countryId: string | null;
  regionIds: string[];
  /** The country's islands: shown alongside its regions, each independently selectable. */
  islandIds: string[];
  pointIds: string[];
}

const NOTHING: MapVisibility = { countryId: null, regionIds: [], islandIds: [], pointIds: [] };

export function computeVisibility(index: WorldIndex, selectedId: string | null): MapVisibility {
  if (!selectedId) return NOTHING;

  const chain = index.chainTo(selectedId);
  const country = chain.find((l) => l.type === 'country');
  const region = chain.find((l) => l.type === 'region');
  const island = chain.find((l) => l.type === 'island');

  const regionIds = country
    ? index.childrenOf(country.id).filter((l) => l.type === 'region').map((l) => l.id)
    : [];
  const islandIds = country
    ? index.childrenOf(country.id).filter((l) => l.type === 'island').map((l) => l.id)
    : [];

  // Inside a region or an island, show everything in it (including places nested in
  // cities). At country level, only show markers attached directly to the country.
  let points = region
    ? index.descendantsOf(region.id)
    : island
      ? index.descendantsOf(island.id)
      : country
        ? index.childrenOf(country.id)
        : [];
  points = points.filter(isPoint);

  return { countryId: country?.id ?? null, regionIds, islandIds, pointIds: points.map((l) => l.id) };
}
