import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import {
  clampView,
  easeInOutCubic,
  fitBounds,
  interpolateView,
  panBy,
  scaleLimits,
  viewBoxOf,
  zoomAt,
  type Size,
  type View,
} from '@/lib/map/viewport';

export interface AnimateOptions {
  /** Milliseconds. Defaults to 700. */
  duration?: number;
  /** Jump straight there (used for the first frame and deep links). */
  instant?: boolean;
}

export interface MapViewport {
  containerRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  /** Re-reads the container size. Call before computing a target so it reflects the current layout. */
  measure(): Size;
  animateTo(target: View, options?: AnimateOptions): void;
  zoomBy(factor: number): void;
  /** Container pixel position -> map coordinates. */
  clientToMap(clientX: number, clientY: number): [number, number] | null;
  /** Current zoom, in screen pixels per map unit. */
  getScale(): number;
}

/** Movement (px) before a press becomes a drag, so ordinary clicks still select things. */
const DRAG_THRESHOLD = 5;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Owns the map camera.
 *
 * The camera lives in a ref and is written straight to the SVG's `viewBox`
 * attribute. Going through React state would re-render the whole map 60 times
 * a second during a zoom animation for no benefit. Scale is also published to
 * CSS as `--s` (px per map unit) so labels and markers can stay a constant
 * on-screen size while the map zooms underneath them.
 */
export function useMapViewport(map: { width: number; height: number }): MapViewport {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef<View>({ cx: map.width / 2, cy: map.height / 2, s: 1 });
  const sizeRef = useRef<Size>({ width: 1, height: 1 });
  const frameRef = useRef<number | null>(null);
  const { width: mapW, height: mapH } = map;

  const apply = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const [x, y, w, h] = viewBoxOf(viewRef.current, sizeRef.current);
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    svg.style.setProperty('--s', String(viewRef.current.s));
  }, []);

  const setView = useCallback(
    (view: View) => {
      viewRef.current = view;
      apply();
    },
    [apply],
  );

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const measure = useCallback((): Size => {
    const el = containerRef.current;
    if (!el) return sizeRef.current;
    const rect = el.getBoundingClientRect();
    const next = { width: Math.max(rect.width, 1), height: Math.max(rect.height, 1) };
    const prev = sizeRef.current;
    if (next.width !== prev.width || next.height !== prev.height) {
      // When the container resizes (e.g. the side panel opens), keep the
      // top-left of the visible map fixed. Otherwise the picture would slide
      // sideways by half the size change.
      const v = viewRef.current;
      const left = v.cx - prev.width / (2 * v.s);
      const top = v.cy - prev.height / (2 * v.s);
      viewRef.current = { ...v, cx: left + next.width / (2 * v.s), cy: top + next.height / (2 * v.s) };
      sizeRef.current = next;
      apply();
    }
    return next;
  }, [apply]);

  const animateTo = useCallback(
    (target: View, { duration = 700, instant = false }: AnimateOptions = {}) => {
      stop();
      const size = sizeRef.current;
      const to = clampView(target, { width: mapW, height: mapH }, scaleLimits({ width: mapW, height: mapH }, size));
      const from = viewRef.current;
      if (instant || duration <= 0 || prefersReducedMotion()) {
        setView(to);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setView(interpolateView(from, to, easeInOutCubic(t)));
        frameRef.current = t < 1 ? requestAnimationFrame(tick) : null;
      };
      frameRef.current = requestAnimationFrame(tick);
    },
    [mapW, mapH, setView, stop],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const size = measure();
      const limits = scaleLimits({ width: mapW, height: mapH }, size);
      const target = zoomAt(viewRef.current, size, { x: size.width / 2, y: size.height / 2 }, factor, limits);
      animateTo(target, { duration: 260 });
    },
    [animateTo, mapW, mapH, measure],
  );

  const clientToMap = useCallback((clientX: number, clientY: number): [number, number] | null => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const v = viewRef.current;
    return [v.cx + (clientX - rect.left - rect.width / 2) / v.s, v.cy + (clientY - rect.top - rect.height / 2) / v.s];
  }, []);

  const getScale = useCallback(() => viewRef.current.s, []);

  // ---- initial layout + resize tracking ------------------------------------
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const size = measure();
    setView(fitBounds({ minX: 0, minY: 0, maxX: mapW, maxY: mapH }, size, 24));
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [mapW, mapH, measure, setView, stop]);

  // ---- wheel zoom and drag pan ----------------------------------------------
  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    const limits = () => scaleLimits({ width: mapW, height: mapH }, sizeRef.current);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // stop the page scrolling while zooming the map
      stop();
      const rect = container.getBoundingClientRect();
      const lineHeight = e.deltaMode === 1 ? 16 : 1;
      const delta = Math.max(-120, Math.min(120, e.deltaY * lineHeight));
      const factor = Math.exp(-delta * 0.0018);
      const zoomed = zoomAt(viewRef.current, sizeRef.current, { x: e.clientX - rect.left, y: e.clientY - rect.top }, factor, limits());
      setView(clampView(zoomed, { width: mapW, height: mapH }, limits()));
    };

    let drag: { id: number; startX: number; startY: number; lastX: number; lastY: number; active: boolean } | null = null;
    let suppressNextClick = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, active: false };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.active) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
        // Only now does this become a drag. Capturing the pointer earlier would
        // steal the click from whatever polygon was pressed.
        drag.active = true;
        stop();
        svg.setPointerCapture(e.pointerId);
        container.dataset.dragging = 'true';
      }
      const panned = panBy(viewRef.current, e.clientX - drag.lastX, e.clientY - drag.lastY);
      setView(clampView(panned, { width: mapW, height: mapH }, limits()));
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
    };

    const endDrag = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.active) {
        suppressNextClick = true; // the click that follows a drag must not select anything
        // If the drag ended off the map no click follows, so don't leave the flag stuck.
        setTimeout(() => {
          suppressNextClick = false;
        }, 0);
        delete container.dataset.dragging;
      }
      drag = null;
    };

    // Capture phase, so this runs before any polygon's own click handler.
    const onClickCapture = (e: MouseEvent) => {
      if (suppressNextClick) {
        e.stopPropagation();
        e.preventDefault();
        suppressNextClick = false;
      }
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('click', onClickCapture, true);
    return () => {
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('pointerdown', onPointerDown);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', endDrag);
      svg.removeEventListener('pointercancel', endDrag);
      svg.removeEventListener('click', onClickCapture, true);
    };
  }, [mapW, mapH, setView, stop]);

  return useMemo(
    () => ({ containerRef, svgRef, measure, animateTo, zoomBy, clientToMap, getScale }),
    [measure, animateTo, zoomBy, clientToMap, getScale],
  );
}
