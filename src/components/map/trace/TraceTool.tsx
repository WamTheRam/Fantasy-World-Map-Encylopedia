/**
 * Dev-only trace tool: click around a shape on the map to create a place, or to
 * redraw one that already exists. Loaded lazily and only when `import.meta.env.DEV`
 * is true, so it is not part of the production build.
 *
 * There are two distinct sessions, and mixing them up was the source of an old bug:
 *
 *   create   a new place. Needs a name, a parent and a fresh id. Refuses any id
 *            that is already used by anything.
 *   redraw   replaces ONLY the shape of one specific existing place, identified
 *            by its id. Name, summary, connections and everything else are never
 *            sent, so they cannot change. The session ends if you navigate away.
 *
 * Two pieces render from here: a drawing layer portalled into the map's SVG (so
 * it shares the map's zoom), and a control panel over the map.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UiIcon } from '@/components/common/UiIcon';
import { cx } from '@/components/common/cx';
import type { MapViewport } from '@/hooks/useMapViewport';
import { formatEntityJson } from '@/lib/content/formatEntity';
import { entityKindLabel } from '@/lib/content/labels';
import { ID_PATTERN } from '@/lib/content/validateWorld';
import type { WorldIndex } from '@/lib/content/worldIndex';
import { defaultParent, nearestVertex, parentOptions, roundCoordinate, slugify, type TraceKind } from '@/lib/map/trace';
import { computeVisibility } from '@/lib/map/visibility';
import { LOCATION_ICONS, isArea, type LocationIconName, type Point } from '@/types/world';
import styles from './Trace.module.css';

interface TraceToolProps {
  index: WorldIndex;
  selectedId: string | null;
  viewport: MapViewport;
  /** A <g> inside the map's SVG for the drawing layer. */
  layerSlot: SVGGElement | null;
  /** Tells the map which shape is being replaced, so it can fade the old one out. */
  onGhostChange: (id: string | null) => void;
}

type Session = { mode: 'create' } | { mode: 'redraw'; targetId: string };

const KINDS: { value: TraceKind; label: string }[] = [
  { value: 'country', label: 'Country' },
  { value: 'region', label: 'Region' },
  { value: 'city', label: 'City' },
  { value: 'poi', label: 'Point of interest' },
  { value: 'island', label: 'Island' },
];
const isAreaKind = (kind: TraceKind) => kind === 'country' || kind === 'region' || kind === 'island';

/** Pixels within which a click snaps to an existing corner. */
const SNAP_PX = 10;
/** Pixels of pointer travel beyond which a press was a drag (pan), not a click. */
const DRAG_PX = 5;

const store = {
  get: (key: string) => {
    try {
      return sessionStorage.getItem(`trace.${key}`);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string | null) => {
    try {
      if (value === null) sessionStorage.removeItem(`trace.${key}`);
      else sessionStorage.setItem(`trace.${key}`, value);
    } catch {
      /* private mode etc: the tool still works, it just forgets between reloads */
    }
  },
};

export default function TraceTool({ index, selectedId, viewport, layerSlot, onGhostChange }: TraceToolProps) {
  const [enabled, setEnabled] = useState(() => store.get('enabled') === '1');
  const [session, setSession] = useState<Session>({ mode: 'create' });
  const [kind, setKind] = useState<TraceKind>(() => (store.get('kind') as TraceKind | null) ?? 'region');
  /** Outlines already finished with "Add Island" this session; the shape currently being clicked out lives in `points`. */
  const [rings, setRings] = useState<Point[][]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [name, setName] = useState('');
  const [idOverride, setIdOverride] = useState<string | null>(null);
  const [parentChoice, setParentChoice] = useState<string | null>(null);
  const [icon, setIcon] = useState<LocationIconName | ''>('');
  const [snap, setSnap] = useState<Point | null>(null);
  const [saving, setSaving] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>(() => (store.get('side') === 'left' ? 'left' : 'right'));
  // A note left just before the page reloaded after a save. It carries a timestamp and
  // expires by age, so a refresh or a second reload can't lose it (or resurrect a stale one).
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(() => {
    try {
      const flash = JSON.parse(store.get('flash') ?? 'null') as { text: string; at: number } | null;
      if (flash && Date.now() - flash.at < 6000) return { tone: 'ok', text: flash.text };
    } catch {
      /* ignore malformed notes */
    }
    return null;
  });

  useEffect(() => store.set('enabled', enabled ? '1' : '0'), [enabled]);
  useEffect(() => store.set('kind', kind), [kind]);
  useEffect(() => store.set('side', side), [side]);

  // ---- which session, and what it is drawing ---------------------------------
  const redrawing = session.mode === 'redraw';
  const target = session.mode === 'redraw' ? index.get(session.targetId) : undefined;
  const activeKind: TraceKind = target ? target.type : kind;
  const areaKind = isAreaKind(activeKind);
  const selected = selectedId ? index.get(selectedId) : undefined;
  const mapWidth = index.world.map.width;

  const endRedraw = () => {
    setSession({ mode: 'create' });
    setRings([]);
    setPoints([]);
    setStatus(null);
  };

  // A redraw belongs to one place. Leave it (or switch the tool off) and the session ends,
  // so points drawn for one place can never be saved onto another.
  useEffect(() => {
    if (session.mode === 'redraw' && (!enabled || session.targetId !== selectedId)) {
      setSession({ mode: 'create' });
      setRings([]);
      setPoints([]);
    }
  }, [session, enabled, selectedId]);

  useEffect(() => {
    onGhostChange(enabled && session.mode === 'redraw' ? session.targetId : null);
    return () => onGhostChange(null);
  }, [enabled, session, onGhostChange]);

  // ---- derived form state (create) --------------------------------------------
  const options = useMemo(() => parentOptions(index, kind), [index, kind]);
  const fallbackParent = useMemo(() => defaultParent(index, kind, selectedId), [index, kind, selectedId]);
  const parentId = options.some((o) => o.id === parentChoice)
    ? parentChoice
    : options.some((o) => o.id === fallbackParent)
      ? fallbackParent
      : (options[0]?.id ?? null);
  const id = idOverride ?? slugify(name);
  /** Ids are unique across everything (places, people, events...). */
  const taken = !redrawing && id !== '' ? index.entity(id) : undefined;

  /** Every outline for this location: outlines finished with "Add Island", plus the one in progress if it's a closed shape. */
  const polygons = useMemo(() => (points.length >= 3 ? [...rings, points] : rings), [rings, points]);

  const shapeReady = areaKind ? polygons.length > 0 : points.length === 1;
  const ready = shapeReady && (redrawing || (name.trim().length > 0 && ID_PATTERN.test(id) && !taken && (kind === 'country' || parentId !== null)));

  const data = useMemo(() => {
    const out: Record<string, unknown> = { id, name: name.trim(), type: kind };
    if (kind !== 'country' && parentId) out.parent = parentId;
    if (!isAreaKind(kind) && icon) out.icon = icon;
    if (isAreaKind(kind)) out.polygons = polygons;
    else if (points[0]) out.coordinates = { x: points[0][0], y: points[0][1] };
    return out;
  }, [id, name, kind, parentId, icon, polygons, points]);

  /** Corners of everything currently drawn: what new points can snap to. */
  const vertices = useMemo(() => {
    const visible = computeVisibility(index, selectedId);
    const areaIds = [...index.countries().map((c) => c.id), ...visible.regionIds, ...visible.islandIds];
    const existing = areaIds.flatMap((areaId) => {
      const location = index.require(areaId);
      return isArea(location) ? location.polygons.flat() : [];
    });
    return [...existing, ...rings.flat()];
  }, [index, selectedId, rings]);

  // ---- map interaction -----------------------------------------------------
  useEffect(() => {
    const container = viewport.containerRef.current;
    const svg = viewport.svgRef.current;
    if (!enabled || !container || !svg) return;

    container.dataset.tracing = 'true';
    let pressed: { x: number; y: number } | null = null;

    const locate = (e: MouseEvent | PointerEvent): { raw: Point; snapped: Point | null } | null => {
      const raw = viewport.clientToMap(e.clientX, e.clientY);
      if (!raw) return null;
      return { raw, snapped: e.altKey ? null : nearestVertex(vertices, raw, SNAP_PX / viewport.getScale()) };
    };

    const onDown = (e: PointerEvent) => {
      pressed = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      const found = svg.contains(e.target as Node) ? locate(e) : null;
      setSnap((prev) => {
        const next = found?.snapped ?? null;
        return prev?.[0] === next?.[0] && prev?.[1] === next?.[1] ? prev : next;
      });
    };
    // Capture phase on the container so this runs before the shapes' own click handlers.
    const onClick = (e: MouseEvent) => {
      if (!svg.contains(e.target as Node)) return; // clicks on buttons and panels are left alone
      if (pressed && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) >= DRAG_PX) return; // that was a pan
      const found = locate(e);
      if (!found) return;
      e.stopPropagation();
      e.preventDefault();
      const point: Point = found.snapped ?? [roundCoordinate(found.raw[0], mapWidth), roundCoordinate(found.raw[1], mapWidth)];
      setStatus(null);
      setPoints((prev) => (areaKind ? [...prev, point] : [point]));
    };

    container.addEventListener('pointerdown', onDown, true);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('click', onClick, true);
    return () => {
      delete container.dataset.tracing;
      container.removeEventListener('pointerdown', onDown, true);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('click', onClick, true);
      setSnap(null);
    };
  }, [enabled, areaKind, vertices, viewport, mapWidth]);

  // ---- actions -------------------------------------------------------------
  const resetForm = () => {
    setRings([]);
    setPoints([]);
    setName('');
    setIdOverride(null);
    setIcon('');
  };

  const startRedraw = () => {
    if (!selected) return;
    setSession({ mode: 'redraw', targetId: selected.id });
    setRings([]);
    setPoints([]);
    setStatus(null);
  };

  const changeKind = (next: TraceKind) => {
    if (next === kind) return;
    if (!(isAreaKind(next) && isAreaKind(kind))) setPoints([]); // a polygon can't become a point, or vice versa
    setRings([]); // starting a different kind of place starts a fresh territory too
    setParentChoice(null);
    setKind(next);
  };

  /** Removes the last click, or (if the current outline is empty) un-finishes the last island. */
  const undo = () => {
    if (points.length > 0) {
      setPoints((prev) => prev.slice(0, -1));
    } else if (rings.length > 0) {
      setPoints(rings[rings.length - 1]);
      setRings((prev) => prev.slice(0, -1));
    }
  };

  /** Finishes the current outline as its own disconnected piece of territory, and starts a new one. */
  const addIsland = () => {
    if (points.length < 3) return;
    setRings((prev) => [...prev, points]);
    setPoints([]);
  };

  // Backspace / Ctrl+Z remove the last point (or, if the current outline is empty, un-finish
  // the last island back into it); Esc clears the current outline (instead of stepping up a level).
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (typing || (points.length === 0 && rings.length === 0) || document.querySelector('dialog[open]')) return;
      if (e.key === 'Backspace' || ((e.ctrlKey || e.metaKey) && e.key === 'z')) {
        e.preventDefault();
        undo();
      } else if (e.key === 'Escape') {
        e.preventDefault(); // tells the page not to also navigate up
        setPoints([]);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, points, rings]);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      // Leave the "saved" note first: the reload Vite triggers can arrive before the response does.
      const note = redrawing && target ? `Redrew “${target.name}”` : `Saved “${name.trim() || id}”`;
      store.set('flash', JSON.stringify({ text: note, at: Date.now() }));
      const geometry = areaKind ? { polygons } : { coordinates: { x: points[0][0], y: points[0][1] } };
      const payload = session.mode === 'redraw' ? { mode: 'update', id: session.targetId, geometry } : { mode: 'create', id, data };
      const response = await fetch(`${import.meta.env.BASE_URL}__atlas/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { path?: string; created?: boolean; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error ?? 'Save failed.');
      resetForm();
      if (redrawing) setSession({ mode: 'create' });
      setStatus({ tone: 'ok', text: note }); // visible if the page is refreshed in place rather than reloaded
    } catch (error) {
      store.set('flash', null);
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard?.writeText(formatEntityJson(data));
    setStatus({ tone: 'ok', text: `Copied. Save it as src/data/locations/…/${id}.json` });
  };

  // ---- drawing layer ---------------------------------------------------------
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ') + (points.length >= 3 ? ' Z' : '');
  const ringPaths = rings.map((ring) => ring.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ') + ' Z');
  const layer: ReactNode = (
    <g className={styles.layer} aria-hidden="true">
      {ringPaths.map((d, i) => (
        <path key={`ring-${i}`} d={d} className={cx(styles.shape, styles.shapeClosed, styles.shapeDone)} />
      ))}
      {rings.map((ring, ri) =>
        ring.map(([x, y], i) => (
          <g key={`ring-${ri}-${i}`} transform={`translate(${x} ${y})`}>
            <g className={styles.dotScale}>
              <circle className={styles.dot} r={4.5} />
            </g>
          </g>
        )),
      )}
      {areaKind && points.length >= 2 && <path d={path} className={cx(styles.shape, points.length >= 3 && styles.shapeClosed)} />}
      {points.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <g className={styles.dotScale}>
            <circle className={cx(styles.dot, i === points.length - 1 && styles.dotLast)} r={i === 0 && areaKind && points.length >= 3 ? 6 : 4.5} />
          </g>
        </g>
      ))}
      {snap && (
        <g transform={`translate(${snap[0]} ${snap[1]})`}>
          <g className={styles.dotScale}>
            <circle className={styles.snap} r={10} />
          </g>
        </g>
      )}
    </g>
  );

  const help = !areaKind
    ? 'Click where it goes on the map. Click again to move it.'
    : points.length === 0
      ? rings.length > 0
        ? 'Click around the edge of the next disconnected piece (an island, or any other separate outline).'
        : 'Click around the edge of the shape. Corners of existing shapes are snapped to (hold Alt to turn that off). Drag to pan, scroll to zoom.'
      : points.length < 3
        ? 'Keep clicking around the edge. The shape closes itself.'
        : 'Add more points, use "Add Island" to start a separate, disconnected piece, or finish below. Backspace removes the last point.';

  const progress = (
    <div className={styles.progress}>
      <span>{areaKind ? `${points.length} ${points.length === 1 ? 'point' : 'points'}` : points[0] ? `x ${points[0][0]}   y ${points[0][1]}` : 'No point yet'}</span>
      <span className={styles.progressButtons}>
        <button type="button" onClick={undo} disabled={points.length === 0 && rings.length === 0}>
          Undo
        </button>
        <button type="button" onClick={() => setPoints([])} disabled={points.length === 0}>
          Clear
        </button>
      </span>
    </div>
  );

  const islandProgress = areaKind && (
    <div className={styles.progress}>
      <span>{rings.length === 0 ? 'One outline so far' : `${rings.length} ${rings.length === 1 ? 'piece' : 'pieces'} added`}</span>
      <span className={styles.progressButtons}>
        <button type="button" onClick={addIsland} disabled={points.length < 3} title="Finish this outline and start tracing a separate, disconnected one (e.g. an island)">
          Add Island
        </button>
      </span>
    </div>
  );

  return (
    <>
      <button type="button" className={cx(styles.toggle, enabled && styles.toggleOn)} aria-pressed={enabled} onClick={() => setEnabled((v) => !v)}>
        <UiIcon name="pencil" size={18} />
        Trace
      </button>

      {enabled && layerSlot && createPortal(layer, layerSlot)}

      {enabled && (
        <section className={cx(styles.panel, side === 'left' && styles.panelLeft)} aria-label="Trace tool">
          <header className={styles.panelHeader}>
            <h2>{redrawing ? 'Redraw shape' : 'Trace tool'}</h2>
            <button type="button" onClick={() => setSide((s) => (s === 'right' ? 'left' : 'right'))} title="Move this panel to the other side of the map" aria-label="Move panel to the other side">
              <UiIcon name="swap" size={16} />
              Move
            </button>
          </header>
          <p className={styles.help}>{help}</p>

          {redrawing && target ? (
            <>
              <div className={styles.redrawBanner}>
                <strong>“{target.name}”</strong>
                <span>{entityKindLabel(target)} · id {target.id}</span>
                <p>
                  Only its {areaKind ? 'outline(s)' : 'position'} will change. Its name, description and connections stay exactly as they are
                  {target.type === 'country'
                    ? '. Regions inside it are not moved, but if it has islands, re-add them here with "Add Island" or their territory will go stale.'
                    : '.'}
                </p>
              </div>
              {progress}
              {islandProgress}
              {status && <p className={cx(styles.status, status.tone === 'error' && styles.statusError)}>{status.text}</p>}
              <div className={styles.actions}>
                <button type="button" className={styles.primary} onClick={save} disabled={!ready || saving}>
                  {saving ? 'Saving…' : rings.length > 0 ? 'Finish Territory' : 'Replace shape'}
                </button>
                <button type="button" onClick={endRedraw} disabled={saving}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {selected && (
                <button type="button" className={styles.redraw} onClick={startRedraw}>
                  Redraw “{selected.name}”
                </button>
              )}

              <div className={styles.kinds} role="group" aria-label="What are you drawing?">
                {KINDS.map((k) => (
                  <button key={k.value} type="button" className={cx(kind === k.value && styles.kindOn)} aria-pressed={kind === k.value} onClick={() => changeKind(k.value)}>
                    {k.label}
                  </button>
                ))}
              </div>

              {progress}
              {islandProgress}

              <label className={styles.field}>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northern March" />
              </label>

              {kind !== 'country' && (
                <label className={styles.field}>
                  Inside
                  <select value={parentId ?? ''} onChange={(e) => setParentChoice(e.target.value)}>
                    {options.length === 0 && <option value="">(nothing to put it in yet)</option>}
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!areaKind && (
                <label className={styles.field}>
                  Icon
                  <select value={icon} onChange={(e) => setIcon(e.target.value as LocationIconName | '')}>
                    <option value="">Default</option>
                    {LOCATION_ICONS.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className={styles.field}>
                File name (id)
                <input value={id} onChange={(e) => setIdOverride(e.target.value)} spellCheck={false} />
              </label>

              {taken && (
                <p className={styles.note}>
                  The id “{id}” is already used by “{taken.name}” ({entityKindLabel(taken)}). Ids are unique across the whole world, so pick another name. To reshape that place, select it and use <strong>Redraw</strong>.
                </p>
              )}
              {id && !ID_PATTERN.test(id) && <p className={styles.note}>Ids use lowercase letters, digits and hyphens only.</p>}
              {status && <p className={cx(styles.status, status.tone === 'error' && styles.statusError)}>{status.text}</p>}

              <div className={styles.actions}>
                <button type="button" className={styles.primary} onClick={save} disabled={!ready || saving}>
                  {saving ? 'Saving…' : rings.length > 0 ? 'Finish Territory' : 'Save'}
                </button>
                <button type="button" onClick={copy} disabled={!ready}>
                  Copy JSON
                </button>
              </div>
              <p className={styles.fine}>
                Creates <code>src/data/locations/…/{id || '…'}.json</code>
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}
