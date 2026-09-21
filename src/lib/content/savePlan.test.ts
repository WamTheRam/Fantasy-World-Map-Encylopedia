import { describe, expect, it } from 'vitest';
import { applyEdits, applyGeometry, defaultContentFile, defaultDataFile, editableFields, planSave, sanitizeRelations, validateEdits } from './savePlan';

const existing = (file: string, type: string) => ({ file, type });

describe('planSave: create', () => {
  it('puts new things in the folder for their kind', () => {
    expect(defaultDataFile('region', 'x')).toBe('data/locations/regions/x.json');
    expect(defaultDataFile('poi', 'x')).toBe('data/locations/points-of-interest/x.json');
    expect(defaultDataFile('deity', 'x')).toBe('data/entities/pantheon/x.json');
    expect(defaultDataFile('person', 'x')).toBe('data/entities/people/x.json');
    expect(defaultDataFile('event', 'x')).toBe('data/history/x.json');
    expect(defaultContentFile('city', 'x')).toBe('content/locations/x.md');
    expect(defaultContentFile('event', 'x')).toBe('content/history/x.md');
    expect(defaultContentFile('faction', 'x')).toBe('content/factions/x.md');
  });

  it('refuses to create over ANY existing id, whatever it is', () => {
    const plan = planSave({ mode: 'create', id: 'central-plains', kind: 'city', existing: [existing('data/locations/regions/central-plains.json', 'region')] });
    expect(plan).toMatchObject({ ok: false, status: 409 });
    expect(plan.ok === false && plan.error).toContain('already used');
  });

  it('creates when the id is free', () => {
    expect(planSave({ mode: 'create', id: 'new-one', kind: 'person', existing: [] })).toEqual({ ok: true, file: 'data/entities/people/new-one.json' });
  });

  it('rejects bad ids and unknown kinds', () => {
    expect(planSave({ mode: 'create', id: '../evil', kind: 'person', existing: [] })).toMatchObject({ ok: false, status: 400 });
    expect(planSave({ mode: 'create', id: 'Bad Id', kind: 'person', existing: [] })).toMatchObject({ ok: false, status: 400 });
    expect(planSave({ mode: 'create', id: 'ok', kind: 'wizard', existing: [] })).toMatchObject({ ok: false, status: 400 });
  });
});

describe('planSave: update', () => {
  it('updates the one file that defines the id, wherever it lives', () => {
    expect(planSave({ mode: 'update', id: 'a', kind: 'region', existing: [existing('data/locations/odd/place/a.json', 'region')] })).toEqual({
      ok: true,
      file: 'data/locations/odd/place/a.json',
    });
  });

  it('refuses to update something that does not exist', () => {
    expect(planSave({ mode: 'update', id: 'ghost', kind: 'region', existing: [] })).toMatchObject({ ok: false, status: 404 });
  });

  it('refuses to change what kind of thing an id is', () => {
    expect(planSave({ mode: 'update', id: 'a', kind: 'city', existing: [existing('x.json', 'region')] })).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses when an id is already defined twice, rather than guessing', () => {
    expect(planSave({ mode: 'update', id: 'a', kind: 'region', existing: [existing('one.json', 'region'), existing('two.json', 'region')] })).toMatchObject({ ok: false, status: 409 });
  });
});

describe('applyEdits', () => {
  const region = {
    id: 'r', name: 'Old', type: 'region', parent: 'c', color: '#abc', summary: 'Old text',
    relations: [{ label: 'x', target: 'y' }], polygon: [[0, 0], [1, 0], [1, 1]], handWritten: true,
  };

  it('changes only editable fields and keeps geometry, parent and unknown keys', () => {
    const out = applyEdits(region, 'region', 'r', { name: 'New', summary: 'New text', polygon: [[9, 9]], parent: 'hacked', type: 'city' });
    expect(out).toMatchObject({ name: 'New', summary: 'New text', parent: 'c', type: 'region', handWritten: true });
    expect(out.polygon).toEqual(region.polygon);
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
    const before = { id: 'r', name: 'R', type: 'region', summary: 'Lore', relations: [{ label: 'a', target: 'b' }], polygon: [[0, 0], [1, 0], [1, 1]] };
    const after = applyGeometry(before, { polygon: [[5, 5], [6, 5], [6, 6], [5, 6]], name: 'ignored' });
    expect(after).toEqual({ ...before, polygon: [[5, 5], [6, 5], [6, 6], [5, 6]] });
  });

  it('moves a marker', () => {
    expect(applyGeometry({ id: 'c', type: 'city', name: 'C', coordinates: { x: 1, y: 1 } }, { coordinates: { x: 9, y: 8 } }).coordinates).toEqual({ x: 9, y: 8 });
  });

  it('rejects malformed geometry', () => {
    expect(() => applyGeometry({ type: 'region' }, { polygon: [[0, 0]] })).toThrow();
    expect(() => applyGeometry({ type: 'city' }, { polygon: [[0, 0], [1, 1], [2, 2]] })).toThrow();
  });
});
