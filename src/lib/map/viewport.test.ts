import { describe, expect, it } from 'vitest';
import { clampView, fitBounds, interpolateView, panBy, scaleLimits, viewBoxOf, zoomAt } from './viewport';

const size = { width: 800, height: 600 };

describe('viewport', () => {
  it('fits bounds inside the container', () => {
    const view = fitBounds({ minX: 100, minY: 100, maxX: 500, maxY: 300 }, size, 0);
    const [x, y, w, h] = viewBoxOf(view, size);
    expect(x).toBeLessThanOrEqual(100);
    expect(y).toBeLessThanOrEqual(100);
    expect(x + w).toBeGreaterThanOrEqual(500);
    expect(y + h).toBeGreaterThanOrEqual(300);
    // Width is the limiting dimension here, so it should fill exactly.
    expect(w).toBeCloseTo(400);
  });

  it('keeps the anchored map point stationary when zooming', () => {
    const view = { cx: 300, cy: 200, s: 2 };
    const anchor = { x: 650, y: 120 };
    const toWorld = (v: typeof view) => ({
      x: v.cx + (anchor.x - size.width / 2) / v.s,
      y: v.cy + (anchor.y - size.height / 2) / v.s,
    });
    const zoomed = zoomAt(view, size, anchor, 1.7);
    expect(zoomed.s).toBeCloseTo(3.4);
    expect(toWorld(zoomed).x).toBeCloseTo(toWorld(view).x);
    expect(toWorld(zoomed).y).toBeCloseTo(toWorld(view).y);
  });

  it('respects scale limits when zooming', () => {
    const limits = { min: 1, max: 4 };
    expect(zoomAt({ cx: 0, cy: 0, s: 3 }, size, { x: 400, y: 300 }, 10, limits).s).toBe(4);
    expect(zoomAt({ cx: 0, cy: 0, s: 3 }, size, { x: 400, y: 300 }, 0.01, limits).s).toBe(1);
  });

  it('pans opposite to the drag direction in map space', () => {
    expect(panBy({ cx: 100, cy: 100, s: 2 }, 20, -10)).toEqual({ cx: 90, cy: 105, s: 2 });
  });

  it('interpolates from start to end', () => {
    const a = { cx: 0, cy: 0, s: 1 };
    const b = { cx: 500, cy: 300, s: 4 };
    expect(interpolateView(a, b, 0)).toEqual(a);
    const end = interpolateView(a, b, 1);
    expect(end.cx).toBeCloseTo(500);
    expect(end.cy).toBeCloseTo(300);
    expect(end.s).toBeCloseTo(4);
    const mid = interpolateView(a, b, 0.5);
    expect(mid.s).toBeCloseTo(2); // geometric midpoint of 1 and 4
  });

  it('handles pure pans (no scale change) without dividing by zero', () => {
    const mid = interpolateView({ cx: 0, cy: 0, s: 2 }, { cx: 100, cy: 0, s: 2 }, 0.5);
    expect(mid).toEqual({ cx: 50, cy: 0, s: 2 });
  });

  it('clamps the camera to the map neighbourhood', () => {
    const map = { width: 1000, height: 500 };
    const limits = scaleLimits(map, size);
    const clamped = clampView({ cx: 99999, cy: -99999, s: 1000 }, map, limits);
    expect(clamped.cx).toBeCloseTo(1150);
    expect(clamped.cy).toBeCloseTo(-75);
    expect(clamped.s).toBeCloseTo(limits.max);
  });
});

describe('fitBounds with a top inset', () => {
  it('reserves room along the top edge without changing the horizontal centre', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const plain = fitBounds(bounds, size, 20);
    const inset = fitBounds(bounds, size, 20, 60);
    expect(inset.s).toBeLessThan(plain.s); // height is the limiting dimension here
    expect(inset.cx).toBe(plain.cx);
    // The shape's top edge must land at least `padding + inset` px below the container's top.
    const [, y] = viewBoxOf(inset, size);
    expect((0 - y) * inset.s).toBeGreaterThanOrEqual(20 + 60 - 0.01);
  });
});
