/**
 * Timeline maths: grouping events by year and deciding where each group sits on
 * the horizontal line. Pure functions, so the spacing rules are testable.
 */
import type { HistoryEvent } from '@/types/world';

const LAST = Number.MAX_SAFE_INTEGER;

/** Chronological, then by `order` within a year, then by name so the result is stable. */
export function compareEvents(a: HistoryEvent, b: HistoryEvent): number {
  return a.year - b.year || (a.order ?? LAST) - (b.order ?? LAST) || a.name.localeCompare(b.name);
}

export interface YearGroup {
  year: number;
  events: HistoryEvent[];
}

/** Events sharing a year end up in one group. Years are only a grouping key, never an identity. */
export function groupByYear(events: readonly HistoryEvent[]): YearGroup[] {
  const groups = new Map<number, HistoryEvent[]>();
  for (const event of [...events].sort(compareEvents)) {
    const list = groups.get(event.year) ?? [];
    list.push(event);
    groups.set(event.year, list);
  }
  return [...groups.entries()].map(([year, list]) => ({ year, events: list })).sort((a, b) => a.year - b.year);
}

export interface TimelineLayoutOptions {
  /** Smallest distance between neighbouring years, in px. */
  minGap?: number;
  /** Largest distance, so a long empty age doesn't create a huge void. */
  maxGap?: number;
  /** How quickly the distance grows with the number of years between events. */
  spread?: number;
  /** Room before the first and after the last point. */
  padding?: number;
}

export interface PositionedGroup extends YearGroup {
  /** Distance from the left edge of the track to this group's point, in px. */
  x: number;
}

export interface TimelineGap {
  fromYear: number;
  toYear: number;
  years: number;
  x: number;
  width: number;
}

export interface TimelineLayout {
  groups: PositionedGroup[];
  gaps: TimelineGap[];
  width: number;
}

/**
 * Distance grows with elapsed time, but logarithmically, so a 400-year gap looks
 * longer than a 5-year one without a single long age making the line unusable.
 * (True proportional spacing would put clustered events on top of each other.)
 */
export function gapWidth(years: number, { minGap = 170, maxGap = 540, spread = 46 }: TimelineLayoutOptions = {}): number {
  return Math.min(maxGap, minGap + spread * Math.log2(1 + Math.max(0, years)));
}

export function layoutTimeline(groups: readonly YearGroup[], options: TimelineLayoutOptions = {}): TimelineLayout {
  const { padding = 150 } = options;
  const positioned: PositionedGroup[] = [];
  const gaps: TimelineGap[] = [];
  let x = padding;
  groups.forEach((group, i) => {
    if (i > 0) {
      const years = group.year - groups[i - 1].year;
      const width = gapWidth(years, options);
      gaps.push({ fromYear: groups[i - 1].year, toYear: group.year, years, x, width });
      x += width;
    }
    positioned.push({ ...group, x });
  });
  return { groups: positioned, gaps, width: x + padding };
}
