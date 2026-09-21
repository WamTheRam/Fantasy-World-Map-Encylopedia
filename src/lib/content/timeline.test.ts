import { describe, expect, it } from 'vitest';
import type { HistoryEvent } from '@/types/world';
import { gapWidth, groupByYear, layoutTimeline } from './timeline';

const ev = (id: string, year: number, extra: Partial<HistoryEvent> = {}): HistoryEvent => ({ id, name: id.toUpperCase(), type: 'event', year, ...extra });

describe('groupByYear', () => {
  it('groups events that share a year, and sorts years ascending', () => {
    const groups = groupByYear([ev('c', 412), ev('a', 100), ev('b', 412), ev('d', 824)]);
    expect(groups.map((g) => [g.year, g.events.map((e) => e.id)])).toEqual([
      [100, ['a']],
      [412, ['b', 'c']],
      [824, ['d']],
    ]);
  });

  it('orders events within a year by "order", then by name', () => {
    const groups = groupByYear([ev('z', 5, { order: 1 }), ev('b', 5), ev('a', 5), ev('y', 5, { order: 0 })]);
    expect(groups[0].events.map((e) => e.id)).toEqual(['y', 'z', 'a', 'b']);
  });

  it('never treats a year as an identity: two events, one year, two ids', () => {
    const [group] = groupByYear([ev('one', 129), ev('two', 129)]);
    expect(group.events).toHaveLength(2);
    expect(new Set(group.events.map((e) => e.id)).size).toBe(2);
  });

  it('handles negative years and no events', () => {
    expect(groupByYear([ev('a', 10), ev('b', -300)]).map((g) => g.year)).toEqual([-300, 10]);
    expect(groupByYear([])).toEqual([]);
  });
});

describe('timeline layout', () => {
  it('spaces groups further apart the more time separates them', () => {
    expect(gapWidth(1)).toBeLessThan(gapWidth(10));
    expect(gapWidth(10)).toBeLessThan(gapWidth(150));
    expect(gapWidth(0)).toBeGreaterThan(0);
  });

  it('caps very long gaps, and keeps a minimum for tiny ones', () => {
    expect(gapWidth(1_000_000)).toBe(540);
    expect(gapWidth(0)).toBeGreaterThanOrEqual(170);
  });

  it('places groups left to right in year order, with padding on both ends', () => {
    const groups = groupByYear([ev('a', 100), ev('b', 243), ev('c', 412), ev('d', 412)]);
    const layout = layoutTimeline(groups, { padding: 100 });
    expect(layout.groups.map((g) => g.year)).toEqual([100, 243, 412]);
    expect(layout.groups[0].x).toBe(100);
    for (let i = 1; i < layout.groups.length; i++) expect(layout.groups[i].x).toBeGreaterThan(layout.groups[i - 1].x);
    expect(layout.width).toBe(layout.groups[2].x + 100);
    expect(layout.gaps.map((g) => g.years)).toEqual([143, 169]);
  });

  it('copes with a single group and an empty list', () => {
    expect(layoutTimeline(groupByYear([ev('a', 1)])).groups).toHaveLength(1);
    expect(layoutTimeline([]).groups).toEqual([]);
  });
});
