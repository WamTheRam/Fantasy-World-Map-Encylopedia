import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMapViewport } from '@/hooks/useMapViewport';
import type { WorldIndex } from '@/lib/content/worldIndex';
import { computeFocusView } from '@/lib/map/focus';
import { countryFill, islandFill, regionFill } from '@/lib/map/theme';
import { computeVisibility } from '@/lib/map/visibility';
import { isArea, isPoint } from '@/types/world';
import { AreaShape, type AreaStatus } from './AreaShape';
import { CoordinateReadout } from './CoordinateReadout';
import { MapControls } from './MapControls';
import { MapLabels } from './MapLabels';
import { MapTooltip, type TooltipContent } from './MapTooltip';
import { PointMarker } from './PointMarker';
import { typeLabel } from './locationIcons';
import styles from './Map.module.css';

/** Dev-only authoring tool. The DEV check is a build-time constant, so production builds drop it entirely. */
const TraceTool = import.meta.env.DEV ? lazy(() => import('./trace/TraceTool')) : null;

interface MapCanvasProps {
  index: WorldIndex;
  /** The current selection. The URL is the source of truth; this component just displays it. */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * The interactive SVG map.
 *
 * It is deliberately "dumb" about routing: it draws whatever `selectedId`
 * says, flies the camera there, and reports clicks through `onSelect`.
 */
export function MapCanvas({ index, selectedId, onSelect }: MapCanvasProps) {
  const { map } = index.world;
  const viewport = useMapViewport(map);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [referenceVisible, setReferenceVisible] = useState(true);
  const [traceSlot, setTraceSlot] = useState<SVGGElement | null>(null);
  /** The place whose shape is being redrawn: shown faded so only the new outline reads as live. */
  const [ghostId, setGhostId] = useState<string | null>(null);

  const visibility = useMemo(() => computeVisibility(index, selectedId), [index, selectedId]);
  const selectedChain = useMemo(
    () => new Set(selectedId ? index.chainTo(selectedId).map((l) => l.id) : []),
    [index, selectedId],
  );
  /** The area that gets the highlighted outline: the selected country/region, or the one holding the selected city. */
  const focusAreaId = useMemo(
    () => (selectedId ? ([...index.chainTo(selectedId)].reverse().find(isArea)?.id ?? null) : null),
    [index, selectedId],
  );

  // ---- camera ---------------------------------------------------------------
  const isFirstFocus = useRef(true);
  const flyToSelection = useCallback(
    (instant: boolean) => {
      // Measure first: opening the side panel has just resized the container.
      const size = viewport.measure();
      const target = computeFocusView(index, selectedId, size);
      const selected = selectedId ? index.get(selectedId) : null;
      viewport.animateTo(target, { instant, duration: selected && isPoint(selected) ? 500 : 750 });
    },
    [index, selectedId, viewport],
  );

  useEffect(() => {
    flyToSelection(isFirstFocus.current); // deep links open already framed, with no fly-in
    isFirstFocus.current = false;
  }, [flyToSelection]);

  // ---- interaction ------------------------------------------------------------
  const handleSelect = useCallback(
    (id: string) => {
      // Clicking what's already selected recenters on it: handy after dragging away.
      if (id === selectedId) flyToSelection(false);
      else onSelect(id);
    },
    [selectedId, onSelect, flyToSelection],
  );

  const tooltip = useMemo<TooltipContent | null>(() => {
    const hovered = hoveredId ? index.get(hoveredId) : null;
    if (!hovered) return null;
    const parent = hovered.parent ? index.get(hovered.parent) : null;
    const type = typeLabel(hovered);
    return { title: hovered.name, subtitle: parent ? `${type} · ${parent.name}` : type };
  }, [hoveredId, index]);

  // ---- what to draw ------------------------------------------------------------
  const countries = index.countries().filter(isArea);
  const regions = visibility.regionIds.map((id) => index.require(id)).filter(isArea);
  const islands = visibility.islandIds.map((id) => index.require(id)).filter(isArea);
  const points = visibility.pointIds.map((id) => index.require(id)).filter(isPoint);

  const countryStatus = (id: string): AreaStatus => {
    if (id === ghostId) return 'ghost';
    if (!selectedId) return 'idle';
    if (id === focusAreaId) return 'selected';
    return id === visibility.countryId ? 'idle' : 'dimmed';
  };
  /** Dims every sibling of `kind` while a different one of that same kind is focused, so only it stands out. */
  const siblingStatus = (kind: 'region' | 'island') => (id: string): AreaStatus => {
    if (id === ghostId) return 'ghost';
    if (id === focusAreaId) return 'selected';
    return focusAreaId && index.require(focusAreaId).type === kind ? 'dimmed' : 'idle';
  };
  const regionStatus = siblingStatus('region');
  const islandStatus = siblingStatus('island');

  const reference = map.referenceImage;

  return (
    <div ref={viewport.containerRef} className={styles.container}>
      <svg ref={viewport.svgRef} className={styles.svg} role="group" aria-label={`Map of ${index.world.name}`}>
        {/* Soft coastline glow under the land. */}
        <g className={styles.halos}>
          {countries.map((c) => (
            <path key={c.id} d={index.svgPathOf(c.id)} className={styles.halo} />
          ))}
        </g>

        <g>
          {countries.map((c) => (
            <AreaShape
              key={c.id}
              id={c.id}
              kind="country"
              d={index.svgPathOf(c.id)}
              fill={countryFill(index, c)}
              status={countryStatus(c.id)}
              label={`${c.name}, ${typeLabel(c)}`}
              onSelect={handleSelect}
              onHover={setHoveredId}
            />
          ))}
        </g>

        {/* Keyed by country so the regions fade in each time a different country is opened. */}
        <g key={visibility.countryId ?? 'none'} className={styles.fadeIn}>
          {regions.map((r) => (
            <AreaShape
              key={r.id}
              id={r.id}
              kind="region"
              d={index.svgPathOf(r.id)}
              fill={regionFill(index, r)}
              status={regionStatus(r.id)}
              label={`${r.name}, ${typeLabel(r)}`}
              onSelect={handleSelect}
              onHover={setHoveredId}
            />
          ))}
          {islands.map((i) => (
            <AreaShape
              key={i.id}
              id={i.id}
              kind="island"
              d={index.svgPathOf(i.id)}
              fill={islandFill(index, i)}
              status={islandStatus(i.id)}
              label={`${i.name}, ${typeLabel(i)}`}
              onSelect={handleSelect}
              onHover={setHoveredId}
            />
          ))}
        </g>

        {/* Traced-over image: sits above the land at partial opacity so outlines can be aligned to it. */}
        {reference && referenceVisible && (
          <image
            href={`${import.meta.env.BASE_URL}${reference.src.replace(/^\//, '')}`}
            x={0}
            y={0}
            width={map.width}
            height={map.height}
            preserveAspectRatio="none"
            opacity={reference.opacity ?? 0.5}
            className={styles.reference}
          />
        )}

        {focusAreaId && focusAreaId !== ghostId && <path d={index.svgPathOf(focusAreaId)} className={styles.outline} />}

        <MapLabels index={index} visibility={visibility} selectedId={selectedId} selectedChain={selectedChain} />

        <g>
          {points.map((p) => (
            <PointMarker key={p.id} location={p} selected={p.id === selectedId} ghost={p.id === ghostId} onSelect={handleSelect} onHover={setHoveredId} />
          ))}
        </g>

        {TraceTool && <g ref={setTraceSlot} />}
      </svg>

      <MapTooltip containerRef={viewport.containerRef} content={tooltip} />
      <MapControls
        onZoomIn={() => viewport.zoomBy(1.6)}
        onZoomOut={() => viewport.zoomBy(1 / 1.6)}
        onRecenter={() => flyToSelection(false)}
        reference={reference ? { visible: referenceVisible, onToggle: () => setReferenceVisible((v) => !v) } : undefined}
      />
      {import.meta.env.DEV && <CoordinateReadout viewport={viewport} />}
      {TraceTool && (
        <Suspense fallback={null}>
          <TraceTool index={index} selectedId={selectedId} viewport={viewport} layerSlot={traceSlot} onGhostChange={setGhostId} />
        </Suspense>
      )}
    </div>
  );
}
