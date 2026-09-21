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

/** Areas are drawn as polygons; points are drawn as markers. */
export type AreaType = 'country' | 'region';
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

interface LocationBase {
  /** Unique, URL-safe slug: lowercase letters, digits and hyphens. Used in URLs. */
  id: string;
  name: string;
  /** `null` for countries. Otherwise the `id` of the containing location. */
  parent: string | null;
  /** Short plain-text overview. Blank lines split paragraphs. */
  summary?: string;
}

export interface AreaLocation extends LocationBase {
  type: AreaType;
  polygon: Point[];
  /** Any CSS colour. Countries get a palette default; regions derive theirs from the country. */
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

export const isArea = (l: AtlasLocation): l is AreaLocation => l.type === 'country' || l.type === 'region';
export const isPoint = (l: AtlasLocation): l is PointLocation => l.type === 'city' || l.type === 'poi';

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
