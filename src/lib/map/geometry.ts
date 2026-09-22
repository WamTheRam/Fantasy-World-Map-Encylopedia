import type { Point } from '@/types/world';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function pointsBounds(points: Point[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Area-weighted centroid. Falls back to the bounding-box centre for degenerate polygons. */
export function polygonCentroid(points: Point[]): Point {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    area2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area2) < 1e-9) {
    const b = pointsBounds(points);
    return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  }
  return [cx / (3 * area2), cy / (3 * area2)];
}

/** Ray-casting point-in-polygon test. Points exactly on an edge may go either way. */
export function pointInPolygon([px, py]: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** SVG path data for a closed polygon. */
export function polygonToPath(points: Point[]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ') + ' Z';
}

/** Twice the (unsigned) area, used only to compare polygons by size. */
function polygonArea(points: Point[]): number {
  let area2 = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    area2 += x0 * y1 - x1 * y0;
  }
  return Math.abs(area2);
}

/**
 * The rest of this file works with a single outline. A location's territory can be
 * several disconnected outlines (a mainland plus islands): these helpers combine them.
 */

/** Bounding box across every outline. */
export function multiPolygonBounds(polygons: readonly Point[][]): Bounds {
  return pointsBounds(polygons.flat());
}

/** True if the point falls inside any one of the outlines. */
export function pointInAnyPolygon(point: Point, polygons: readonly Point[][]): boolean {
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

/** SVG path data covering every outline (one closed sub-path per outline). */
export function multiPolygonToPath(polygons: readonly Point[][]): string {
  return polygons.map(polygonToPath).join(' ');
}

/** The largest outline by area: the "mainland", as opposed to a smaller island. */
export function largestPolygon(polygons: readonly Point[][]): Point[] {
  return polygons.reduce((best, next) => (polygonArea(next) > polygonArea(best) ? next : best));
}

/** A good label spot for a multi-outline territory: the interior point of its largest outline. */
export function interiorLabelPointMulti(polygons: readonly Point[][]): Point {
  return interiorLabelPoint(largestPolygon(polygons));
}

/**
 * A good spot for a label: the centroid, unless the shape is concave enough
 * that the centroid falls outside it. In that case, use the midpoint of the
 * widest stretch of the shape along the centroid's horizontal line.
 */
export function interiorLabelPoint(polygon: Point[]): Point {
  const centroid = polygonCentroid(polygon);
  if (pointInPolygon(centroid, polygon)) return centroid;

  const y = centroid[1];
  const xs: number[] = [];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
  }
  xs.sort((a, b) => a - b);

  let best: Point = centroid;
  let bestWidth = -1;
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const width = xs[k + 1] - xs[k];
    if (width > bestWidth) {
      bestWidth = width;
      best = [(xs[k] + xs[k + 1]) / 2, y];
    }
  }
  return best;
}
