/**
 * Marker glyphs, one per icon name usable in a location's `"icon"` field.
 *
 * Each glyph is drawn in a 16x16 box centred on (0, 0) using `currentColor`,
 * so it inherits colour from wherever it is placed. To add an icon:
 *   1. add its name to LOCATION_ICONS in `types/world.ts`
 *   2. add an entry to ICONS below.
 */
import type { ReactNode } from 'react';
import type { AtlasLocation, LocationIconName } from '@/types/world';

function starPath(outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(Math.cos(angle) * radius).toFixed(2)} ${(Math.sin(angle) * radius).toFixed(2)}`);
  }
  return `M${points.join(' L')} Z`;
}

interface IconDefinition {
  label: string;
  glyph: ReactNode;
}

export const ICONS: Record<LocationIconName, IconDefinition> = {
  capital: { label: 'Capital', glyph: <path d={starPath(7.6, 3.1)} fill="currentColor" /> },
  city: {
    label: 'City',
    glyph: (
      <g fill="currentColor">
        <rect x="-6" y="-1" width="3.4" height="6.5" />
        <rect x="-1.7" y="-6" width="3.4" height="11.5" />
        <rect x="2.6" y="-3" width="3.4" height="8.5" />
      </g>
    ),
  },
  town: { label: 'Town', glyph: <path d="M-5.2 5V0L0 -5l5.2 5v5Z" fill="currentColor" /> },
  village: { label: 'Village', glyph: <circle r="2.8" fill="currentColor" /> },
  castle: {
    label: 'Castle',
    glyph: <path d="M-6 6V-5h3v2h2v-2h2v2h2v-2h3V6Z" fill="currentColor" />,
  },
  temple: {
    label: 'Temple',
    glyph: (
      <g fill="currentColor">
        <path d="M-7 -1.5 0 -6.5l7 5Z" />
        <rect x="-5.2" y="0" width="2" height="5" />
        <rect x="-1" y="0" width="2" height="5" />
        <rect x="3.2" y="0" width="2" height="5" />
        <rect x="-7" y="5.8" width="14" height="1.6" />
      </g>
    ),
  },
  ruin: {
    label: 'Ruins',
    glyph: <path d="M-5.5 6V-1l1.6-2.4L-2.3 -1V6ZM1.8 6V-3.6L3.6 -6.4 5.5 -3.6V6Z" fill="currentColor" />,
  },
  battlefield: {
    label: 'Battlefield',
    glyph: (
      <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d="M-5 -5 5 5M5 -5 -5 5" />
        <path d="M-6.4 -2.6 -2.6 -6.4M6.4 -2.6 2.6 -6.4" strokeWidth="1.5" />
      </g>
    ),
  },
  dungeon: {
    label: 'Dungeon',
    glyph: (
      <g fill="currentColor">
        <circle cy="-2" r="3.2" />
        <path d="M-1.8 0h3.6L3 6.4H-3Z" />
      </g>
    ),
  },
  other: { label: 'Point of interest', glyph: <path d="M0 -6.2 6.2 0 0 6.2-6.2 0Z" fill="currentColor" /> },
};

/** The icon a location shows: its own `icon`, or a sensible default for its type. */
export function iconFor(location: AtlasLocation): LocationIconName {
  if (location.type === 'city' || location.type === 'poi') {
    return location.icon ?? (location.type === 'city' ? 'city' : 'other');
  }
  return 'other';
}

/** Human-readable type shown in tooltips and headings: "Country", "Region", or the icon's label. */
export function typeLabel(location: AtlasLocation): string {
  switch (location.type) {
    case 'country':
      return 'Country';
    case 'region':
      return 'Region';
    default:
      return ICONS[iconFor(location)].label;
  }
}

/** A standalone badge-style icon for HTML contexts such as list rows. */
export function IconChip({ icon, size = 22 }: { icon: LocationIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-11 -11 22 22" aria-hidden="true" focusable="false" style={{ color: 'var(--ink)' }}>
      <circle r="10" fill="var(--paper-raised)" stroke="var(--line)" strokeWidth="1" />
      <g style={{ color: icon === 'capital' ? 'var(--accent)' : 'var(--ink)' }} transform="scale(.82)">
        {ICONS[icon].glyph}
      </g>
    </svg>
  );
}
