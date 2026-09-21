import { describe, expect, it } from 'vitest';
import { buildWorld } from './buildWorld';

const world = { id: 'w', name: 'Test World', map: { width: 100, height: 100 } };
const square = [[0, 0], [50, 0], [50, 50], [0, 50]];

const country = { id: 'c', name: 'C', type: 'country', polygon: square };
const region = { id: 'r', name: 'R', type: 'region', parent: 'c', polygon: square };
const city = { id: 'x', name: 'X', type: 'city', parent: 'r', coordinates: { x: 10, y: 10 } };

const file = (path: string, data: unknown) => ({ path, data });
const errors = (result: ReturnType<typeof buildWorld>) => result.issues.filter((i) => i.severity === 'error');
const warnings = (result: ReturnType<typeof buildWorld>) => result.issues.filter((i) => i.severity === 'warning');

describe('validateWorld', () => {
  it('accepts a minimal valid world', () => {
    const result = buildWorld(world, [file('a.json', country), file('b.json', region), file('c.json', city)]);
    expect(result.issues).toEqual([]);
    expect(result.index?.childrenOf('r').map((l) => l.id)).toEqual(['x']);
  });

  it('reports a missing parent with the file name', () => {
    const result = buildWorld(world, [file('a.json', country), file('b.json', { ...region, parent: 'nope' })]);
    expect(result.index).toBeNull();
    expect(errors(result)[0]).toMatchObject({ file: 'b.json' });
    expect(errors(result)[0].message).toContain('"nope"');
  });

  it('reports duplicate ids', () => {
    const result = buildWorld(world, [file('a.json', country), file('b.json', country)]);
    expect(errors(result)[0].message).toContain('Duplicate id');
  });

  it('rejects invalid nesting, such as a region inside a region', () => {
    const nested = { ...region, id: 'r2', parent: 'r' };
    const result = buildWorld(world, [file('a.json', country), file('b.json', region), file('c.json', nested)]);
    expect(errors(result)[0].message).toContain("can't sit inside");
  });

  it('rejects unknown icons and lists the valid ones', () => {
    const result = buildWorld(world, [
      file('a.json', country),
      file('b.json', region),
      file('c.json', { ...city, icon: 'volcano' }),
    ]);
    expect(errors(result)[0].message).toContain('capital');
  });

  it('rejects malformed polygons', () => {
    const result = buildWorld(world, [file('a.json', { ...country, polygon: [[0, 0], [1, 1]] })]);
    expect(errors(result)[0].message).toContain('polygon');
  });

  it('warns (but still loads) when a marker is outside its region', () => {
    const stray = { ...city, coordinates: { x: 90, y: 90 } };
    const result = buildWorld(world, [file('a.json', country), file('b.json', region), file('c.json', stray)]);
    expect(result.index).not.toBeNull();
    expect(warnings(result)[0].message).toContain('outside the polygon');
  });

  it('warns when geometry falls off the map', () => {
    const result = buildWorld(world, [file('a.json', { ...country, polygon: [[0, 0], [200, 0], [200, 50]] })]);
    expect(result.index).not.toBeNull();
    expect(warnings(result)[0].message).toContain('outside the map');
  });
});
