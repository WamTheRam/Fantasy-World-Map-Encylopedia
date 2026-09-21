import { describe, expect, it } from 'vitest';
import { atlasPath, resolveAtlasPath } from '@/lib/routing/atlasPaths';
import { computeVisibility } from '@/lib/map/visibility';
import { worldLoad } from './loadWorld';
import { groupByYear } from './timeline';
import { entityPath } from '@/lib/routing/entityPaths';

/**
 * Guards the bundled DEMO world (Aldermere). These assertions are about the demo's
 * specific contents, so DELETE THIS FILE when you replace the demo with your own
 * world. `worldData.test.ts` keeps checking that your data is valid.
 */
describe('demo world', () => {
  it('loads with no errors or warnings', () => {
    expect(worldLoad.issues).toEqual([]);
    expect(worldLoad.index).not.toBeNull();
  });

  const index = worldLoad.index!;

  it('has the expected hierarchy', () => {
    expect(index.countries()).toHaveLength(3);
    const regions = index.locations.filter((l) => l.type === 'region');
    expect(regions.length).toBeGreaterThanOrEqual(6);
    for (const region of regions) expect(index.require(region.parent!).type).toBe('country');
  });

  it('builds canonical breadcrumb paths', () => {
    expect(atlasPath(index, 'aurelia')).toBe('/atlas/kingdom-of-valen/central-plains/aurelia');
    expect(atlasPath(index, null)).toBe('/atlas');
  });

  it('resolves canonical paths, short links and unknown paths', () => {
    expect(resolveAtlasPath(index, undefined)).toEqual({ status: 'root' });
    expect(resolveAtlasPath(index, 'kingdom-of-valen/central-plains/aurelia').status).toBe('found');
    expect(resolveAtlasPath(index, 'aurelia')).toEqual({
      status: 'redirect',
      to: '/atlas/kingdom-of-valen/central-plains/aurelia',
    });
    expect(resolveAtlasPath(index, 'atlantis').status).toBe('not-found');
  });

  it('shows the right level of detail for each selection', () => {
    expect(computeVisibility(index, null)).toEqual({ countryId: null, regionIds: [], pointIds: [] });

    const country = computeVisibility(index, 'kingdom-of-valen');
    expect(country.regionIds).toHaveLength(3);
    expect(country.pointIds).toEqual([]);

    const region = computeVisibility(index, 'central-plains');
    expect(region.pointIds).toContain('aurelia');
    expect(region.pointIds).not.toContain('seabreak');

    // Selecting a city keeps its whole region's markers visible.
    expect(computeVisibility(index, 'aurelia').pointIds).toEqual(region.pointIds);
  });

  it('has entries in every encyclopedia section', () => {
    for (const type of ['person', 'faction', 'organization', 'deity', 'politics', 'culture'] as const) {
      expect(index.loreOfType(type).length, type).toBeGreaterThanOrEqual(3);
    }
  });

  it('groups the nine historical events into six years, three of them shared', () => {
    expect(index.events).toHaveLength(9);
    expect(groupByYear(index.events).map((g) => g.events.length)).toEqual([1, 1, 3, 2, 1, 1]);
  });

  it('routes each kind of entity where the README says', () => {
    expect(entityPath(index, 'aurelia')).toBe('/atlas/kingdom-of-valen/central-plains/aurelia');
    expect(entityPath(index, 'queen-elara-ii')).toBe('/people/queen-elara-ii');
    expect(entityPath(index, 'house-valen')).toBe('/factions/house-valen');
    expect(entityPath(index, 'veyr')).toBe('/pantheon/veyr');
    expect(entityPath(index, 'the-sundering')).toBe('/history/the-sundering');
  });

  it('links entities into a web: relations, mentions in text, and backlinks', () => {
    const backlinks = index.backlinksOf('veyr').map((b) => b.id);
    expect(backlinks).toEqual(expect.arrayContaining(['queen-elara-ii', 'house-valen', 'wanderers-cairn']));
    expect(index.markdownOf('aurelia')).toContain('kingdom-of-valen'); // a bare id in prose
    expect(index.links.references(index.markdownOf('aurelia')!).has('kingdom-of-valen')).toBe(true);
  });
});
