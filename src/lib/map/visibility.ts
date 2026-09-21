import type { WorldIndex } from '@/lib/content/worldIndex';
import { isPoint } from '@/types/world';

/**
 * Level-of-detail rules: what the map draws for a given selection.
 *
 *   nothing selected   countries only
 *   country selected   + that country's regions
 *   region selected    + that region's cities and points of interest
 *   city selected      same as its region
 *
 * Keeping these rules in one small function (rather than scattered through
 * components) makes the behaviour easy to see and to change.
 */
export interface MapVisibility {
  /** Country whose regions are drawn, if any. */
  countryId: string | null;
  regionIds: string[];
  pointIds: string[];
}

const NOTHING: MapVisibility = { countryId: null, regionIds: [], pointIds: [] };

export function computeVisibility(index: WorldIndex, selectedId: string | null): MapVisibility {
  if (!selectedId) return NOTHING;

  const chain = index.chainTo(selectedId);
  const country = chain.find((l) => l.type === 'country');
  const region = chain.find((l) => l.type === 'region');

  const regionIds = country
    ? index.childrenOf(country.id).filter((l) => l.type === 'region').map((l) => l.id)
    : [];

  // Inside a region, show everything in it (including places nested in cities).
  // At country level, only show markers attached directly to the country.
  let points = region
    ? index.descendantsOf(region.id)
    : country
      ? index.childrenOf(country.id)
      : [];
  points = points.filter(isPoint);

  return { countryId: country?.id ?? null, regionIds, pointIds: points.map((l) => l.id) };
}
