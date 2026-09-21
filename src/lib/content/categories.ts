import type { LoreType } from '@/types/world';

/**
 * The encyclopedia's sections. Each maps one entity `type` to a URL segment,
 * a menu label, and the folder its Markdown lives in.
 */
export interface Category {
  /** URL segment and Markdown folder: /people/queen-elara-ii */
  id: string;
  type: LoreType;
  label: string;
  singular: string;
  blurb: string;
}

export const CATEGORIES: readonly Category[] = [
  { id: 'people', type: 'person', label: 'People', singular: 'Person', blurb: 'Rulers, heroes, scoundrels and other souls worth knowing.' },
  { id: 'factions', type: 'faction', label: 'Factions', singular: 'Faction', blurb: 'Houses, movements and groups united by a cause.' },
  { id: 'organizations', type: 'organization', label: 'Organizations', singular: 'Organization', blurb: 'Guilds, orders, councils and institutions.' },
  { id: 'pantheon', type: 'deity', label: 'Pantheon', singular: 'Deity', blurb: 'The gods, and where and how they are worshipped.' },
  { id: 'politics', type: 'politics', label: 'Politics', singular: 'Political entry', blurb: 'Governments, alliances, disputes and how power works.' },
  { id: 'culture', type: 'culture', label: 'Culture', singular: 'Culture entry', blurb: 'Customs, traditions, trade, magic and creatures.' },
];

export const categoryOfType = (type: LoreType): Category => {
  const category = CATEGORIES.find((c) => c.type === type);
  if (!category) throw new Error(`No category for type "${type}"`);
  return category;
};

export const categoryById = (id: string): Category | undefined => CATEGORIES.find((c) => c.id === id);
