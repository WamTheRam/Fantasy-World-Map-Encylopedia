import { describe, expect, it } from 'vitest';
import { atlasPath, resolveAtlasPath } from '@/lib/routing/atlasPaths';
import { computeVisibility } from '@/lib/map/visibility';
import { worldLoad } from './loadWorld';

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
});
