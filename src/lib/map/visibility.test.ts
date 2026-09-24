import { describe, expect, it } from 'vitest';
import { buildWorld } from '@/lib/content/buildWorld';
import { computeVisibility } from './visibility';

const world = { id: 'w', name: 'Test World', map: { width: 100, height: 100 } };
const square = [[0, 0], [50, 0], [50, 50], [0, 50]];
const file = (path: string, data: unknown) => ({ path, data });

const country = { id: 'c', name: 'C', type: 'country', polygons: [square] };
const region = { id: 'r', name: 'R', type: 'region', parent: 'c', polygons: [square] };
const cityInRegion = { id: 'city-r', name: 'City in region', type: 'city', parent: 'r', coordinates: { x: 10, y: 10 } };
const island = { id: 'i', name: 'I', type: 'island', parent: 'c', polygons: [[[60, 60], [70, 60], [70, 70]]] };
const cityOnIsland = { id: 'city-i', name: 'City on island', type: 'city', parent: 'i', coordinates: { x: 62, y: 62 } };
const poiOnIsland = { id: 'poi-i', name: 'Ruin on island', type: 'poi', parent: 'i', coordinates: { x: 63, y: 63 } };

const index = () =>
  buildWorld(world, [
    file('country.json', country),
    file('region.json', region),
    file('city-r.json', cityInRegion),
    file('island.json', island),
    file('city-i.json', cityOnIsland),
    file('poi-i.json', poiOnIsland),
  ]).index!;

describe('computeVisibility', () => {
  it('shows nothing selected as just the region and island lists, no points', () => {
    expect(computeVisibility(index(), null)).toEqual({ countryId: null, regionIds: [], islandIds: [], pointIds: [] });
  });

  it('at country level, lists its regions and islands but no points from inside either', () => {
    const v = computeVisibility(index(), 'c');
    expect(v.countryId).toBe('c');
    expect(v.regionIds).toEqual(['r']);
    expect(v.islandIds).toEqual(['i']);
    expect(v.pointIds).toEqual([]);
  });

  it('selecting a region reveals its own points', () => {
    const v = computeVisibility(index(), 'r');
    expect(v.pointIds).toEqual(['city-r']);
  });

  it('selecting an island reveals its own points, just like a region does', () => {
    const v = computeVisibility(index(), 'i');
    expect(v.countryId).toBe('c');
    expect(v.pointIds).toEqual(expect.arrayContaining(['city-i', 'poi-i']));
    expect(v.pointIds).toHaveLength(2);
  });

  it('selecting a point on an island keeps the whole island in view', () => {
    const v = computeVisibility(index(), 'city-i');
    expect(v.countryId).toBe('c');
    expect(v.pointIds).toEqual(expect.arrayContaining(['city-i', 'poi-i']));
  });

  it('selecting a point in a region does not pull in the island next door', () => {
    const v = computeVisibility(index(), 'city-r');
    expect(v.pointIds).toEqual(['city-r']);
  });
});
