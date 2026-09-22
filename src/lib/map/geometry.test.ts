import { describe, expect, it } from 'vitest';
import type { Point } from '@/types/world';
import {
  interiorLabelPoint,
  interiorLabelPointMulti,
  largestPolygon,
  multiPolygonBounds,
  multiPolygonToPath,
  pointInAnyPolygon,
  pointInPolygon,
  pointsBounds,
  polygonCentroid,
  polygonToPath,
} from './geometry';

const square: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
// A "C" shape whose centroid lies in the hollow, outside the polygon.
const cShape: Point[] = [[0, 0], [10, 0], [10, 2], [2, 2], [2, 8], [10, 8], [10, 10], [0, 10]];

describe('geometry', () => {
  it('computes bounds', () => {
    expect(pointsBounds(square)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });

  it('computes an area-weighted centroid', () => {
    expect(polygonCentroid(square)).toEqual([5, 5]);
  });

  it('tests point containment', () => {
    expect(pointInPolygon([5, 5], square)).toBe(true);
    expect(pointInPolygon([15, 5], square)).toBe(false);
    expect(pointInPolygon([5, 5], cShape)).toBe(false);
  });

  it('keeps labels inside concave shapes', () => {
    const [x, y] = interiorLabelPoint(cShape);
    expect(pointInPolygon([x, y], cShape)).toBe(true);
  });

  it('builds a closed SVG path', () => {
    expect(polygonToPath(square)).toBe('M0 0 L10 0 L10 10 L0 10 Z');
  });
});

describe('multi-outline territory (mainland plus islands)', () => {
  const mainland = square;
  const island: Point[] = [[100, 100], [110, 100], [110, 110]];
  const polygons = [mainland, island];

  it('takes the bounding box across every outline', () => {
    expect(multiPolygonBounds(polygons)).toEqual({ minX: 0, minY: 0, maxX: 110, maxY: 110 });
  });

  it('tests containment against any outline', () => {
    expect(pointInAnyPolygon([5, 5], polygons)).toBe(true);
    expect(pointInAnyPolygon([105, 103], polygons)).toBe(true);
    expect(pointInAnyPolygon([50, 105], polygons)).toBe(false);
  });

  it('builds one closed sub-path per outline', () => {
    expect(multiPolygonToPath(polygons)).toBe(`${polygonToPath(mainland)} ${polygonToPath(island)}`);
  });

  it('picks the largest outline as the "mainland"', () => {
    expect(largestPolygon(polygons)).toBe(mainland);
    expect(largestPolygon([island, mainland])).toBe(mainland);
  });

  it('anchors the label on the largest outline', () => {
    expect(interiorLabelPointMulti(polygons)).toEqual(interiorLabelPoint(mainland));
  });
});
