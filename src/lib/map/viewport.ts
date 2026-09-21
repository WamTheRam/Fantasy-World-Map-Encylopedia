/**
 * Pure camera maths for the map. No React, no DOM: everything here is a plain
 * function of numbers, which keeps it easy to test.
 *
 * The camera is `{ cx, cy, s }`:
 *   cx, cy  the map coordinate shown at the centre of the container
 *   s       scale, in screen pixels per map unit
 *
 * Storing scale in absolute pixels (rather than "zoom relative to the fitted
 * world") means resizing the container never rescales the picture.
 */
import type { Bounds } from './geometry';

export interface View {
  cx: number;
  cy: number;
  s: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ScaleLimits {
  min: number;
  max: number;
}

/** The SVG viewBox `[x, y, width, height]` that displays `view` in a container of `size`. */
export function viewBoxOf(view: View, size: Size): [number, number, number, number] {
  const w = size.width / view.s;
  const h = size.height / view.s;
  return [view.cx - w / 2, view.cy - h / 2, w, h];
}

/**
 * The camera that fits `bounds` inside the container with `padding` px to spare.
 * `topInset` reserves extra room along the top edge (for floating UI such as
 * the header) and shifts the framing down to match.
 */
export function fitBounds(bounds: Bounds, size: Size, padding = 48, topInset = 0): View {
  const bw = Math.max(bounds.maxX - bounds.minX, 1);
  const bh = Math.max(bounds.maxY - bounds.minY, 1);
  const availW = Math.max(size.width - padding * 2, 1);
  const availH = Math.max(size.height - padding * 2 - topInset, 1);
  const s = Math.min(availW / bw, availH / bh);
  return {
    cx: (bounds.minX + bounds.maxX) / 2,
    // The usable area's centre sits topInset/2 below the screen's centre, so look that much higher.
    cy: (bounds.minY + bounds.maxY) / 2 - topInset / 2 / s,
    s,
  };
}

export function scaleLimits(map: { width: number; height: number }, size: Size): ScaleLimits {
  const fit = fitBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height }, size, 0).s;
  return { min: fit * 0.7, max: fit * 40 };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Zoom by `factor` while keeping the map point under `anchor` (container
 * pixels) exactly where it is. This is what makes wheel-zoom feel anchored to
 * the cursor.
 */
export function zoomAt(
  view: View,
  size: Size,
  anchor: { x: number; y: number },
  factor: number,
  limits?: ScaleLimits,
): View {
  const s = limits ? clamp(view.s * factor, limits.min, limits.max) : view.s * factor;
  const dx = anchor.x - size.width / 2;
  const dy = anchor.y - size.height / 2;
  const wx = view.cx + dx / view.s;
  const wy = view.cy + dy / view.s;
  return { cx: wx - dx / s, cy: wy - dy / s, s };
}

/** Pan by a screen-space delta (positive dx drags the map to the right). */
export function panBy(view: View, dx: number, dy: number): View {
  return { ...view, cx: view.cx - dx / view.s, cy: view.cy - dy / view.s };
}

/** Keep the camera inside sensible limits so the map can't be lost off-screen. */
export function clampView(view: View, map: { width: number; height: number }, limits: ScaleLimits): View {
  const marginX = map.width * 0.15;
  const marginY = map.height * 0.15;
  return {
    s: clamp(view.s, limits.min, limits.max),
    cx: clamp(view.cx, -marginX, map.width + marginX),
    cy: clamp(view.cy, -marginY, map.height + marginY),
  };
}

/**
 * Interpolates between two cameras for a smooth zoom-and-pan.
 *
 * Interpolating scale geometrically and the centre proportionally to how far
 * the *visible width* has changed keeps the motion perceptually even: a point
 * that is on screen at both ends glides in a straight line rather than
 * swooping. (It is the same idea as d3's `interpolateZoom`, simplified.)
 */
export function interpolateView(a: View, b: View, t: number): View {
  const ua = 1 / a.s;
  const ub = 1 / b.s;
  const u = ua * Math.pow(ub / ua, t);
  const w = Math.abs(ub - ua) < 1e-9 ? t : (u - ua) / (ub - ua);
  return { cx: a.cx + (b.cx - a.cx) * w, cy: a.cy + (b.cy - a.cy) * w, s: 1 / u };
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
