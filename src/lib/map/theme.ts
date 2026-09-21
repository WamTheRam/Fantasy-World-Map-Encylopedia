import type { WorldIndex } from '@/lib/content/worldIndex';
import type { AtlasLocation } from '@/types/world';

/** Earthy defaults, used when a country has no `"color"` of its own. */
const COUNTRY_PALETTE = ['#a9b78a', '#dcc189', '#a9aeb9', '#cba28c', '#94b1a7', '#bea8c2'];

/** Regions are the country colour nudged lighter or darker so neighbours stay distinguishable. */
const REGION_TINTS = [
  { mix: '#ffffff', amount: 20 },
  { mix: '#6b4f2f', amount: 12 },
  { mix: '#ffffff', amount: 6 },
  { mix: '#3f5a4b', amount: 12 },
];

export function countryFill(index: WorldIndex, country: AtlasLocation): string {
  if (country.type === 'country' && country.color) return country.color;
  const position = Math.max(0, index.countries().findIndex((c) => c.id === country.id));
  return COUNTRY_PALETTE[position % COUNTRY_PALETTE.length];
}

export function regionFill(index: WorldIndex, region: AtlasLocation): string {
  if (region.type === 'region' && region.color) return region.color;
  const country = region.parent ? index.require(region.parent) : null;
  const base = country ? countryFill(index, country) : COUNTRY_PALETTE[0];
  const siblings = country ? index.childrenOf(country.id).filter((l) => l.type === 'region') : [];
  const position = Math.max(0, siblings.findIndex((l) => l.id === region.id));
  const tint = REGION_TINTS[position % REGION_TINTS.length];
  return `color-mix(in srgb, ${base}, ${tint.mix} ${tint.amount}%)`;
}
