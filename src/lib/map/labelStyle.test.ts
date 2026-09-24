import { describe, expect, it } from 'vitest';
import { computeCountryLabelStyles } from './labelStyle';

describe('computeCountryLabelStyles', () => {
  it('gives a larger country a bigger font than a smaller one', () => {
    const styles = computeCountryLabelStyles(new Map([['big', 1_000_000], ['small', 1_000]]));
    expect(styles.get('big')!.fontSize).toBeGreaterThan(styles.get('small')!.fontSize);
  });

  it('is continuous: a middling country sits strictly between the extremes', () => {
    const styles = computeCountryLabelStyles(
      new Map([
        ['small', 1_000],
        ['medium', 100_000],
        ['big', 10_000_000],
      ]),
    );
    const small = styles.get('small')!.fontSize;
    const medium = styles.get('medium')!.fontSize;
    const big = styles.get('big')!.fontSize;
    expect(medium).toBeGreaterThan(small);
    expect(big).toBeGreaterThan(medium);
  });

  it('lets a bigger country reveal its label at a lower (more zoomed-out) scale', () => {
    const styles = computeCountryLabelStyles(new Map([['big', 1_000_000], ['small', 1_000]]));
    expect(styles.get('big')!.revealAt).toBeLessThan(styles.get('small')!.revealAt);
    expect(styles.get('big')!.fullAt).toBeLessThan(styles.get('small')!.fullAt);
  });

  it('always reveals before becoming fully opaque', () => {
    const styles = computeCountryLabelStyles(new Map([['a', 500], ['b', 50_000]]));
    for (const style of styles.values()) expect(style.fullAt).toBeGreaterThan(style.revealAt);
  });

  it('handles a single country without dividing by zero', () => {
    const styles = computeCountryLabelStyles(new Map([['only', 42_000]]));
    const style = styles.get('only')!;
    expect(Number.isFinite(style.fontSize)).toBe(true);
    expect(Number.isFinite(style.revealAt)).toBe(true);
    expect(Number.isFinite(style.fullAt)).toBe(true);
  });

  it('handles an empty map', () => {
    expect(computeCountryLabelStyles(new Map())).toEqual(new Map());
  });

  it('handles a zero-area country without producing NaN or Infinity', () => {
    const styles = computeCountryLabelStyles(new Map([['flat', 0], ['normal', 10_000]]));
    for (const style of styles.values()) {
      expect(Number.isFinite(style.fontSize)).toBe(true);
      expect(Number.isFinite(style.revealAt)).toBe(true);
      expect(Number.isFinite(style.fullAt)).toBe(true);
    }
  });
});
