import { describe, expect, it } from 'vitest';
import type { Point } from '../../types/world';
import { applyEdits, applyGeometry, defaultContentFile, defaultDataFile, editableFields, planSave, sanitizeRelations, syncIslandIntoParent, validateEdits } from './savePlan';

const existing = (file: string, type: string) => ({ file, type });

describe('planSave: create', () => {
  it('puts new things in the folder for their kind', () => {
    expect(defaultDataFile('argoyll', 'region', 'x')).toBe('data/worlds/argoyll/locations/regions/x.json');
    expect(defaultDataFile('argoyll', 'island', 'x')).toBe('data/worlds/argoyll/locations/islands/x.json');
    expect(defaultDataFile('argoyll', 'poi', 'x')).toBe('data/worlds/argoyll/locations/points-of-interest/x.json');
    expect(defaultDataFile('argoyll', 'deity', 'x')).toBe('data/worlds/argoyll/entities/pantheon/x.json');
    expect(defaultDataFile('argoyll', 'person', 'x')).toBe('data/worlds/argoyll/entities/people/x.json');
    expect(defaultDataFile('argoyll', 'event', 'x')).toBe('data/worlds/argoyll/history/x.json');
    expect(defaultContentFile('argoyll', 'city', 'x')).toBe('content/worlds/argoyll/locations/x.md');
    expect(defaultContentFile('argoyll', 'event', 'x')).toBe('content/worlds/argoyll/history/x.md');
    expect(defaultContentFile('argoyll', 'faction', 'x')).toBe('content/worlds/argoyll/factions/x.md');
  });

  it('refuses to create over ANY existing id, whatever it is', () => {
    const plan = planSave({
      mode: 'create',
      worldId: 'argoyll',
      id: 'central-plains',
      kind: 'city',
      existing: [existing('data/worlds/argoyll/locations/regions/central-plains.json', 'region')],
    });
    expect(plan).toMatchObject({ ok: false, status: 409 });
    expect(plan.ok === false && plan.error).toContain('already used');
  });

  it('creates when the id is free', () => {
    expect(planSave({ mode: 'create', worldId: 'argoyll', id: 'new-one', kind: 'person', existing: [] })).toEqual({
      ok: true,
      file: 'data/worlds/argoyll/entities/people/new-one.json',
    });
  });

  it('rejects bad ids, bad world ids, and unknown kinds', () => {
    expect(planSave({ mode: 'create', worldId: 'argoyll', id: '../evil', kind: 'person', existing: [] })).toMatchObject({ ok: false, status: 400 });
    expect(planSave({ mode: 'create', worldId: 'argoyll', id: 'Bad Id', kind: 'person', existing: [] })).toMatchObject({ ok: false, status: 400 });
    expect(planSave({ mode: 'create', worldId: 'argoyll', id: 'ok', kind: 'wizard', existing: [] })).toMatchObject({ ok: false, status: 400 });
    expect(planSave({ mode: 'create', worldId: '../evil', id: 'ok', kind: 'person', existing: [] })).toMatchObject({ ok: false, status: 400 });
  });
});

describe('planSave: update', () => {
  it('updates the one file that defines the id, wherever it lives', () => {
    expect(
      planSave({ mode: 'update', worldId: 'argoyll', id: 'a', kind: 'region', existing: [existing('data/worlds/argoyll/locations/odd/place/a.json', 'region')] }),
    ).toEqual({
      ok: true,
      file: 'data/worlds/argoyll/locations/odd/place/a.json',
    });
  });

  it('refuses to update something that does not exist', () => {
    expect(planSave({ mode: 'update', worldId: 'argoyll', id: 'ghost', kind: 'region', existing: [] })).toMatchObject({ ok: false, status: 404 });
  });

  it('refuses to change what kind of thing an id is', () => {
    expect(planSave({ mode: 'update', worldId: 'argoyll', id: 'a', kind: 'city', existing: [existing('x.json', 'region')] })).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses when an id is already defined twice, rather than guessing', () => {
    expect(
      planSave({ mode: 'update', worldId: 'argoyll', id: 'a', kind: 'region', existing: [existing('one.json', 'region'), existing('two.json', 'region')] }),
    ).toMatchObject({ ok: false, status: 409 });
  });
});

describe('applyEdits', () => {
  const region = {
    id: 'r', name: 'Old', type: 'region', parent: 'c', color: '#abc', summary: 'Old text',
    relations: [{ label: 'x', target: 'y' }], polygons: [[[0, 0], [1, 0], [1, 1]]], handWritten: true,
  };

  it('changes only editable fields and keeps geometry, parent and unknown keys', () => {
    const out = applyEdits(region, 'region', 'r', { name: 'New', summary: 'New text', polygons: [[[9, 9]]], parent: 'hacked', type: 'city' });
    expect(out).toMatchObject({ name: 'New', summary: 'New text', parent: 'c', type: 'region', handWritten: true });
    expect(out.polygons).toEqual(region.polygons);
  });

  it('removes a field when it is cleared, but never removes the name', () => {
    const out = applyEdits(region, 'region', 'r', { summary: '  ', color: null, relations: [] });
    expect(out).not.toHaveProperty('summary');
    expect(out).not.toHaveProperty('color');
    expect(out).not.toHaveProperty('relations');
    expect(applyEdits(region, 'region', 'r', { name: '' }).name).toBe('');
    expect(validateEdits('region', { name: '' })).toContain('name');
  });

  it('starts a new record for create, with id and type', () => {
    expect(applyEdits(null, 'person', 'p', { name: 'P', summary: 'Hello' })).toEqual({ id: 'p', type: 'person', name: 'P', summary: 'Hello' });
  });

  it('accepts year and order only for events', () => {
    expect(applyEdits(null, 'event', 'e', { name: 'E', year: 412, order: 2 })).toMatchObject({ year: 412, order: 2 });
    expect(applyEdits(null, 'person', 'p', { name: 'P', year: 412 })).not.toHaveProperty('year');
    expect(applyEdits({ id: 'e', name: 'E', type: 'event', year: 5, order: 2 }, 'event', 'e', { order: null })).not.toHaveProperty('order');
  });

  it('lists what may be edited for each kind', () => {
    expect(editableFields('city')).toContain('icon');
    expect(editableFields('country')).toContain('color');
    expect(editableFields('island')).toContain('color');
    expect(editableFields('event')).toEqual(expect.arrayContaining(['year', 'order']));
    expect(editableFields('person')).not.toContain('icon');
  });

  it('validates events, icons and orders', () => {
    expect(validateEdits('event', { year: 4.5 })).toContain('year');
    expect(validateEdits('event', { year: 'Year 4' })).toContain('year');
    expect(validateEdits('event', { year: -20 })).toBeNull();
    expect(validateEdits('city', { icon: 'volcano' })).toContain('icon');
    expect(validateEdits('event', { year: 5, order: 'x' })).toContain('order');
  });
});

describe('sanitizeRelations', () => {
  it('drops incomplete rows and trims labels', () => {
    expect(sanitizeRelations([{ label: ' Ruler of ', target: 'a-b' }, { label: '', target: 'x' }, { label: 'y', target: 'Bad Id' }, null, 'junk'])).toEqual([
      { label: 'Ruler of', target: 'a-b' },
    ]);
    expect(sanitizeRelations('nope')).toEqual([]);
  });
});

describe('applyGeometry', () => {
  it('replaces only the shape, leaving name, summary and connections untouched', () => {
    const before = { id: 'r', name: 'R', type: 'region', summary: 'Lore', relations: [{ label: 'a', target: 'b' }], polygons: [[[0, 0], [1, 0], [1, 1]]] };
    const after = applyGeometry(before, { polygons: [[[5, 5], [6, 5], [6, 6], [5, 6]]], name: 'ignored' });
    expect(after).toEqual({ ...before, polygons: [[[5, 5], [6, 5], [6, 6], [5, 6]]] });
  });

  it('accepts several disconnected outlines (a mainland plus islands)', () => {
    const before = { id: 'c', name: 'C', type: 'country', polygons: [[[0, 0], [1, 0], [1, 1]]] };
    const mainland: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const island: Point[] = [[20, 20], [22, 20], [22, 22]];
    expect(applyGeometry(before, { polygons: [mainland, island] }).polygons).toEqual([mainland, island]);
  });

  it('moves a marker', () => {
    expect(applyGeometry({ id: 'c', type: 'city', name: 'C', coordinates: { x: 1, y: 1 } }, { coordinates: { x: 9, y: 8 } }).coordinates).toEqual({ x: 9, y: 8 });
  });

  it('rejects malformed geometry', () => {
    expect(() => applyGeometry({ type: 'region' }, { polygons: [[[0, 0]]] })).toThrow();
    expect(() => applyGeometry({ type: 'region' }, { polygons: [] })).toThrow();
    expect(() => applyGeometry({ type: 'city' }, { polygons: [[[0, 0], [1, 1], [2, 2]]] })).toThrow();
  });
});

describe('syncIslandIntoParent', () => {
  const mainland: Point[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const islandOld: Point[] = [[10, 10], [12, 10], [12, 12]];
  const islandNew: Point[] = [[50, 50], [52, 50], [52, 52]];

  it('appends a new island (nothing old to remove)', () => {
    expect(syncIslandIntoParent([mainland], [], [islandNew])).toEqual([mainland, islandNew]);
  });

  it('swaps a redrawn island for its old outline, wherever it sits in the list', () => {
    expect(syncIslandIntoParent([mainland, islandOld], [islandOld], [islandNew])).toEqual([mainland, islandNew]);
  });

  it('still adds the new outline when the old one cannot be found (e.g. a hand-edited file)', () => {
    expect(syncIslandIntoParent([mainland], [islandOld], [islandNew])).toEqual([mainland, islandNew]);
  });

  it('removes every old ring an island contributed, even if it had several', () => {
    const islandOld2: Point[] = [[60, 60], [62, 60], [62, 62]];
    expect(syncIslandIntoParent([mainland, islandOld, islandOld2], [islandOld, islandOld2], [islandNew])).toEqual([mainland, islandNew]);
  });
});
