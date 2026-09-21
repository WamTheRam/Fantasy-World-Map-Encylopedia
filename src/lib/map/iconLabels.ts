import type { LocationIconName } from '@/types/world';

/** Human-readable names for each marker icon. Kept apart from the SVG glyphs so pure logic can use them. */
export const ICON_LABELS: Record<LocationIconName, string> = {
  capital: 'Capital',
  city: 'City',
  town: 'Town',
  village: 'Village',
  castle: 'Castle',
  temple: 'Temple',
  ruin: 'Ruins',
  battlefield: 'Battlefield',
  dungeon: 'Dungeon',
  other: 'Point of interest',
};
