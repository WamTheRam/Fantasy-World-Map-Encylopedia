/**
 * Data model for the geographic atlas.
 *
 * These types describe exactly what lives in `src/data/`. Anything you can put
 * in a JSON file is described here, and `lib/content/validateWorld.ts` checks
 * incoming JSON against these rules with friendly error messages.
 */

/** [x, y] in map coordinates. See README -> "Map coordinates". */
export type Point = [x: number, y: number];

export interface Coordinates {
  x: number;
  y: number;
}

/**
 * Areas are drawn as polygons; points are drawn as markers.
 *
 * An `island` is an area too: a named, independently selectable place (with its
 * own id, summary, etc.) that also happens to be disconnected territory of a
 * parent `country`. See `AreaLocation.polygons` below.
 */
export type AreaType = 'country' | 'region' | 'island';
export type PointType = 'city' | 'poi';
export type LocationType = AreaType | PointType;

/** Marker glyphs. Adding one means adding an entry in `components/map/locationIcons.tsx`. */
export const LOCATION_ICONS = [
  'capital',
  'city',
  'town',
  'village',
  'castle',
  'temple',
  'ruin',
  'battlefield',
  'dungeon',
  'other',
] as const;
export type LocationIconName = (typeof LOCATION_ICONS)[number];

/** A labelled, one-directional link from one entity to another: "Ruler of" -> kingdom-of-valen. */
export interface Relation {
  label: string;
  /** The `id` of any entity: a place, person, faction, deity, event, and so on. */
  target: string;
}

interface LocationBase {
  /** Unique, URL-safe slug: lowercase letters, digits and hyphens. Used in URLs. */
  id: string;
  name: string;
  /** `null` for countries. Otherwise the `id` of the containing location. */
  parent: string | null;
  /** Short overview, written in Markdown. Names and ids in it become links automatically. */
  summary?: string;
  relations?: Relation[];
  /** Path to an image, relative to `public/` (e.g. `"images/aurelion.jpg"`). Optional. */
  image?: string;
}

export interface AreaLocation extends LocationBase {
  type: AreaType;
  /**
   * One or more disconnected outlines that together make up this location's
   * territory: usually one (a simple blob), but a mainland-plus-islands shape
   * has several. Order doesn't matter; each ring is at least 3 `[x, y]` points.
   *
   * An `island` location's own `polygons` identifies the island itself. Its
   * parent country's `polygons` also contains a copy of the same ring(s), so
   * the country's territory (and its hover/selection highlight) includes the
   * island automatically, without any special-casing at render time.
   */
  polygons: Point[][];
  /** Any CSS colour. Countries get a palette default; regions and islands derive theirs from the country. */
  color?: string;
  /** Overrides the automatically computed label position. */
  labelPosition?: Coordinates;
}

export interface PointLocation extends LocationBase {
  type: PointType;
  coordinates: Coordinates;
  icon?: LocationIconName;
}

export type AtlasLocation = AreaLocation | PointLocation;

export const isArea = (l: AtlasLocation): l is AreaLocation =>
  l.type === 'country' || l.type === 'region' || l.type === 'island';
export const isPoint = (l: AtlasLocation): l is PointLocation => l.type === 'city' || l.type === 'poi';
/** An island is an area (it has `polygons`) that also belongs to a parent country's territory. */
export const isIsland = (l: AtlasLocation): l is AreaLocation & { type: 'island' } => l.type === 'island';

/** Contents of `src/data/world.json`. */
export interface WorldConfig {
  id: string;
  name: string;
  tagline?: string;
  summary?: string;
  map: {
    /** Size of the map coordinate space. Match your reference image's pixel size to trace it 1:1. */
    width: number;
    height: number;
    /** Optional image drawn over the polygons (at partial opacity) while you trace them. Path is relative to `public/`. */
    referenceImage?: {
      src: string;
      /** 0 to 1. Defaults to 0.5. */
      opacity?: number;
    };
  };
}

// ---------------------------------------------------------------------------
// Everything that isn't a place
// ---------------------------------------------------------------------------

/** Encyclopedia entries: one `type` per section of the encyclopedia. */
export const LORE_TYPES = ['person', 'faction', 'organization', 'deity', 'politics', 'culture'] as const;
export type LoreType = (typeof LORE_TYPES)[number];

export interface LoreEntity {
  id: string;
  name: string;
  type: LoreType;
  summary?: string;
  relations?: Relation[];
  /** Path to an image, relative to `public/` (e.g. `"images/aurelion.jpg"`). Optional. */
  image?: string;
}

/**
 * A historical event. Years are NOT unique: any number of events may share one.
 * Each event is its own entity with its own id; the timeline groups them by year.
 */
export interface HistoryEvent {
  id: string;
  name: string;
  type: 'event';
  year: number;
  /** Orders events that share a year (lower first). Optional. */
  order?: number;
  summary?: string;
  relations?: Relation[];
  /** Path to an image, relative to `public/` (e.g. `"images/aurelion.jpg"`). Optional. */
  image?: string;
}

/** Anything with an id that can be linked to. */
export type Entity = AtlasLocation | LoreEntity | HistoryEvent;
export type EntityType = LocationType | LoreType | 'event';

export const isLocationEntity = (e: Entity): e is AtlasLocation =>
  e.type === 'country' || e.type === 'region' || e.type === 'island' || e.type === 'city' || e.type === 'poi';
export const isEvent = (e: Entity): e is HistoryEvent => e.type === 'event';
export const isLore = (e: Entity): e is LoreEntity => !isLocationEntity(e) && !isEvent(e);
