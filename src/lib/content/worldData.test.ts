import { describe, expect, it } from 'vitest';
import { atlasPath, resolveAtlasPath } from '@/lib/routing/atlasPaths';
import { entityPath } from '@/lib/routing/entityPaths';
import { worldLoad } from './loadWorld';

/**
 * Checks that work for ANY world, so this file stays useful after you replace
 * the demo data with your own. (`npm test` doubles as "is my world valid?".)
 * Warnings, such as a marker placed just outside its region, are reported by
 * the app but deliberately do not fail the tests.
 */
describe('world data', () => {
  it('has no errors', () => {
    const errors = worldLoad.issues.filter((i) => i.severity === 'error');
    expect(errors, errors.map((e) => `${e.file}: ${e.message}`).join('\n')).toEqual([]);
    expect(worldLoad.index).not.toBeNull();
  });

  it('gives every location a URL that resolves back to itself', () => {
    const index = worldLoad.index!;
    for (const location of index.locations) {
      const path = atlasPath(index, location.id);
      const resolution = resolveAtlasPath(index, path.replace('/atlas/', ''));
      expect(resolution.status, path).toBe('found');
    }
  });

  it('gives every entity of every kind a route, and no two share one', () => {
    const index = worldLoad.index!;
    const routes = index.allEntities().map((e) => entityPath(index, e.id));
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('keeps ids unique across places, people, events and everything else', () => {
    const ids = worldLoad.index!.allEntities().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
