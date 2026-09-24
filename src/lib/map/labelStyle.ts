/**
 * Continuous country-label sizing, from each country's map-space area.
 *
 * Bigger countries get bigger names and stay legible zoomed all the way out;
 * small countries fade their names in only once the map has zoomed in enough
 * for them to have earned the room. Kept as a pure function (no React, no DOM)
 * so it's easy to reason about and unit-test; `MapLabels` just applies the
 * numbers it returns as CSS custom properties.
 */

export interface CountryLabelStyle {
  /** Base font size in px, before the map's `--s` (screen px per map unit) divides it down. */
  fontSize: number;
  /** The camera scale (`--s`) at which the label starts to fade in. */
  revealAt: number;
  /** The camera scale at which the label is fully opaque. */
  fullAt: number;
}

const FONT_MIN = 12;
const FONT_MAX = 23;

/**
 * A country's outline must render at least this many on-screen px (its
 * `sqrt(area) * scale`, a rough proxy for its apparent width) before its name
 * starts to appear. Expressing the threshold this way, rather than as a raw
 * scale number, keeps it independent of the map's coordinate units.
 */
const REVEAL_PX = 62;
const FULL_PX = REVEAL_PX * 1.8;

/**
 * Maps each country's area to a font size (continuous, relative to the other
 * countries on the map) and a reveal/fully-visible scale pair. `areas` is
 * `id -> area in map-coordinate units squared`.
 */
export function computeCountryLabelStyles(areas: ReadonlyMap<string, number>): Map<string, CountryLabelStyle> {
  const sizes = new Map<string, number>();
  for (const [id, area] of areas) sizes.set(id, Math.sqrt(Math.max(area, 0)));

  // A log scale keeps the size spread even though real countries vary by orders
  // of magnitude in area (a small island next to a continent-spanning empire).
  const logSizes = [...sizes.values()].map((size) => Math.log(Math.max(size, 1)));
  const lo = logSizes.length ? Math.min(...logSizes) : 0;
  const hi = logSizes.length ? Math.max(...logSizes) : 0;
  const span = hi - lo;

  const out = new Map<string, CountryLabelStyle>();
  for (const [id, size] of sizes) {
    const t = span > 1e-9 ? (Math.log(Math.max(size, 1)) - lo) / span : 1;
    const fontSize = FONT_MIN + t * (FONT_MAX - FONT_MIN);
    const clampedSize = Math.max(size, 1);
    out.set(id, { fontSize, revealAt: REVEAL_PX / clampedSize, fullAt: FULL_PX / clampedSize });
  }
  return out;
}
