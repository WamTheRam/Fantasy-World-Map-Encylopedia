/**
 * The top-level sections in the hamburger menu.
 *
 * Sections whose pages don't exist yet are listed with `enabled: true` so the
 * menu shows the intended shape of the encyclopedia. Flip a flag to `true`
 * when its page is built.
 */
export interface NavSection {
  id: string;
  label: string;
  path: string;
  description: string;
  enabled: boolean;
}

export const NAV_SECTIONS: readonly NavSection[] = [
  { id: 'atlas', label: 'Atlas', path: '/atlas', description: 'Explore the map', enabled: true },
  { id: 'people', label: 'People', path: '/people', description: 'Rulers, heroes and other souls', enabled: true },
  { id: 'factions', label: 'Factions', path: '/factions', description: 'Groups with a cause', enabled: true },
  { id: 'organizations', label: 'Organizations', path: '/organizations', description: 'Guilds, orders and institutions', enabled: true },
  { id: 'pantheon', label: 'Pantheon', path: '/pantheon', description: 'Gods and their followers', enabled: true },
  { id: 'politics', label: 'Politics', path: '/politics', description: 'Governments, alliances, conflicts', enabled: true },
  { id: 'culture', label: 'Culture', path: '/culture', description: 'Customs, magic, trade and creatures', enabled: true },
  { id: 'history', label: 'History', path: '/history', description: 'A timeline of events', enabled: true },
];
