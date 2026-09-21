import { describe, expect, it } from 'vitest';
import { buildWorld } from '@/lib/content/buildWorld';
import { formatLocationJson } from '@/lib/content/formatLocation';
import { defaultParent, nearestVertex, parentOptions, roundCoordinate, slugify } from './trace';

const world = { id: 'w', name: 'W', map: { width: 500, height: 500 } };
const square = [[0, 0], [100, 0], [100, 100], [0, 100]];
const { index } = buildWorld(world, [
  { path: 'a.json', data: { id: 'c', name: 'Country', type: 'country', polygon: square } },
  { path: 'b.json', data: { id: 'r', name: 'Region', type: 'region', parent: 'c', polygon: square } },
  { path: 'c.json', data: { id: 'x', name: 'City', type: 'city', parent: 'r', coordinates: { x: 5, y: 5 } } },
]);

describe('trace helpers', () => {
  it('slugifies names into valid ids', () => {
    expect(slugify("Hagen's Field")).toBe('hagens-field');
    expect(slugify('  Þe Old  Road!! ')).toBe('e-old-road');
    expect(slugify('Café Noir')).toBe('cafe-noir');
  });

  it('snaps to the nearest vertex within the radius, else nothing', () => {
    const vertices: [number, number][] = [[10, 10], [30, 10]];
    expect(nearestVertex(vertices, [12, 11], 5)).toEqual([10, 10]);
    expect(nearestVertex(vertices, [20, 10], 5)).toBeNull();
    expect(nearestVertex(vertices, [28, 10], 5)).toEqual([30, 10]);
  });

  it('rounds to whole numbers on big maps and tenths on small ones', () => {
    expect(roundCoordinate(12.6, 1200)).toBe(13);
    expect(roundCoordinate(1.26, 100)).toBe(1.3);
  });

  it('offers only legal parents, labelled with their trail', () => {
    expect(parentOptions(index!, 'country')).toEqual([]);
    expect(parentOptions(index!, 'region').map((o) => o.id)).toEqual(['c']);
    expect(parentOptions(index!, 'city').map((o) => o.label)).toEqual(['Country', 'Region, Country']);
    expect(parentOptions(index!, 'poi')).toHaveLength(3);
  });

  it('defaults the parent to the deepest allowed place in the current selection', () => {
    expect(defaultParent(index!, 'city', 'x')).toBe('r'); // a city can't hold a city, so its region
    expect(defaultParent(index!, 'poi', 'x')).toBe('x');
    expect(defaultParent(index!, 'region', 'r')).toBe('c');
    expect(defaultParent(index!, 'region', null)).toBeNull();
  });
});

describe('formatLocationJson', () => {
  it('produces JSON that parses back to the same data', () => {
    const data = { id: 'r', name: 'Region', type: 'region', parent: 'c', polygon: [[1, 2], [3, 4], [5, 6]] };
    expect(JSON.parse(formatLocationJson(data))).toEqual(data);
  });

  it('keeps one polygon point per line and puts polygon last', () => {
    const text = formatLocationJson({ polygon: [[1, 2], [3, 4], [5, 6]], name: 'N', id: 'n', type: 'region' });
    expect(text).toContain('    [1, 2],\n    [3, 4],\n    [5, 6]\n');
    expect(text.indexOf('"polygon"')).toBeGreaterThan(text.indexOf('"type"'));
  });

  it('writes coordinates inline', () => {
    expect(formatLocationJson({ id: 'x', coordinates: { x: 4, y: 9 } })).toContain('"coordinates": { "x": 4, "y": 9 }');
  });
});

describe('mergeLocation', () => {
  it('keeps fields the tool does not know about when re-tracing', async () => {
    const { mergeLocation } = await import('@/lib/content/mergeLocation');
    const existing = { id: 'r', name: 'Old', type: 'region', parent: 'c', summary: 'Hand-written lore.', color: '#abc', polygon: [[0, 0]] };
    const incoming = { id: 'r', name: 'New', type: 'region', parent: 'c', polygon: [[1, 1], [2, 2], [3, 3]] };
    expect(mergeLocation(existing, incoming)).toEqual({
      id: 'r', name: 'New', type: 'region', parent: 'c', summary: 'Hand-written lore.', color: '#abc', polygon: [[1, 1], [2, 2], [3, 3]],
    });
  });

  it('starts fresh when the type changed, or when there was no file', async () => {
    const { mergeLocation } = await import('@/lib/content/mergeLocation');
    const incoming = { id: 'x', name: 'X', type: 'region', polygon: [] };
    expect(mergeLocation({ id: 'x', type: 'city', summary: 's', coordinates: { x: 1, y: 1 } }, incoming)).toEqual(incoming);
    expect(mergeLocation(null, incoming)).toEqual(incoming);
  });
});
