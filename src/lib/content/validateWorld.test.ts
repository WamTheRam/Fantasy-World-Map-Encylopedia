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

describe('entities beyond places', () => {
  const person = { id: 'queen', name: 'The Queen', type: 'person', summary: 'Rules from [[c]].', relations: [{ label: 'Ruler of', target: 'c' }] };
  const event = (id: string, year: unknown) => ({ id, name: id, type: 'event', year });
  const base = () => [file('a.json', country), file('b.json', region), file('c.json', city)];

  it('accepts people, events and Markdown content', () => {
    const result = buildWorld(world, [...base(), file('d.json', person), file('e.json', event('war', 129))], [
      { path: 'src/content/people/queen.md', id: 'queen', text: 'Long **lore**.' },
    ]);
    expect(result.issues).toEqual([]);
    expect(result.index?.markdownOf('queen')).toBe('Long **lore**.');
    expect(result.index?.entity('war')?.type).toBe('event');
  });

  it('requires ids to be unique across kinds, not just within one kind', () => {
    const clash = { id: 'c', name: 'Also C', type: 'person' }; // "c" is already a country
    const result = buildWorld(world, [...base(), file('d.json', clash)]);
    expect(errors(result)[0].message).toContain('Duplicate id "c"');
  });

  it('lets several events share a year but not an id', () => {
    const ok = buildWorld(world, [...base(), file('d.json', event('one', 129)), file('e.json', event('two', 129))]);
    expect(ok.issues).toEqual([]);
    expect(ok.index?.events.map((e) => e.id).sort()).toEqual(['one', 'two']);
    const clash = buildWorld(world, [...base(), file('d.json', event('one', 129)), file('e.json', event('one', 130))]);
    expect(errors(clash)[0].message).toContain('Duplicate id "one"');
  });

  it('requires a whole-number year on events', () => {
    for (const bad of [undefined, 'Year 4', 4.5, null]) {
      const result = buildWorld(world, [...base(), file('d.json', event('e', bad))]);
      expect(errors(result)[0].message, String(bad)).toContain('"year"');
    }
    expect(buildWorld(world, [...base(), file('d.json', event('e', -20))]).index).not.toBeNull(); // years before zero are fine
  });

  it('rejects malformed relations, but only warns about unknown targets', () => {
    const bad = buildWorld(world, [...base(), file('d.json', { ...person, relations: [{ label: 'x' }] })]);
    expect(errors(bad)[0].message).toContain('relations');
    const dangling = buildWorld(world, [...base(), file('d.json', { ...person, relations: [{ label: 'Ally of', target: 'ghost' }] })]);
    expect(dangling.index).not.toBeNull();
    expect(warnings(dangling)[0].message).toContain('"ghost"');
  });

  it('warns about broken [[links]] and orphaned content files', () => {
    const result = buildWorld(world, [...base(), file('d.json', { ...person, summary: 'See [[ghost]].' })], [
      { path: 'src/content/people/nobody.md', id: 'nobody', text: 'x' },
    ]);
    const text = warnings(result).map((w) => w.message).join('\n');
    expect(text).toContain('[[ghost]]');
    expect(text).toContain('"nobody"');
    expect(result.index).not.toBeNull();
  });

  it('computes backlinks from relations and from mentions in text', () => {
    const result = buildWorld(world, [...base(), file('d.json', person)]);
    const back = result.index!.backlinksOf('c');
    expect(back).toEqual([{ id: 'queen', label: 'Ruler of' }]); // relation label wins over the plain text mention
  });
});
