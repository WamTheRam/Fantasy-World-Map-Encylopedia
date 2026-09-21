import { describe, expect, it } from 'vitest';
import { LinkResolver, explicitTargets } from './links';

const resolver = new LinkResolver([
  { id: 'house-valen', name: 'House Valen' },
  { id: 'aurelia', name: 'Aurelia' },
  { id: 'kingdom-of-valen', name: 'Kingdom of Valen' },
  { id: 'veyr', name: 'Veyr' },
  { id: 'the-war', name: 'The War' },
  { id: 'the-sundering', name: 'The Sundering' },
  { id: 'the-founding', name: 'The Founding' },
  { id: 'founding', name: 'Founding' }, // makes the alias for The Founding ambiguous
  { id: 'twin-a', name: 'Twin' },
  { id: 'twin-b', name: 'Twin' }, // two entities share a name
]);

const links = (text: string, opts?: Parameters<LinkResolver['split']>[1]) =>
  resolver.split(text, opts).flatMap((s) => (s.kind === 'link' ? [`${s.via}:${s.id}`] : []));

describe('LinkResolver', () => {
  it('links explicit [[id]] and [[id|text]] references', () => {
    expect(resolver.split('See [[house-valen]].')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', id: 'house-valen', label: 'House Valen', via: 'wiki', known: true },
      { kind: 'text', text: '.' },
    ]);
    const custom = resolver.split('[[aurelia|the capital]]')[0];
    expect(custom).toMatchObject({ label: 'the capital', id: 'aurelia' });
  });

  it('flags explicit links to unknown ids instead of dropping them', () => {
    expect(resolver.split('[[nowhere]]')[0]).toMatchObject({ kind: 'link', id: 'nowhere', known: false, label: 'nowhere' });
  });

  it('links a bare id, showing the entity name', () => {
    const [segment] = resolver.split('kingdom-of-valen is old');
    expect(segment).toMatchObject({ kind: 'link', id: 'kingdom-of-valen', via: 'id', label: 'Kingdom of Valen' });
  });

  it('links an exact name, keeping the wording as written', () => {
    expect(links('Rulers of Aurelia rest here.')).toEqual(['name:aurelia']);
    expect(resolver.split('Aurelia')[0]).toMatchObject({ label: 'Aurelia' });
  });

  it('prefers the longest match', () => {
    expect(links('The Kingdom of Valen and House Valen')).toEqual(['name:kingdom-of-valen', 'name:house-valen']);
  });

  it('matches a name without its leading "The", as people write it', () => {
    expect(resolver.split('after the Sundering, roads')[1]).toMatchObject({ kind: 'link', id: 'the-sundering', label: 'Sundering' });
    expect(links('The Sundering was long ago')).toEqual(['name:the-sundering']); // the full name still works
  });

  it('does not make short or ambiguous shortenings into links', () => {
    expect(links('the War is over')).toEqual([]); // "War" is too short to be a safe alias
    expect(links('The Founding, and Founding again')).toEqual(['name:the-founding', 'name:founding']);
  });

  it('only matches whole tokens', () => {
    expect(links('Aureliano, aurelian, preveyr, house-valenar')).toEqual([]);
    expect(links("Aurelia's markets")).toEqual(['name:aurelia']); // possessive still links
  });

  it('does not link names that are case-different', () => {
    expect(links('the aurelia district')).toEqual(['id:aurelia']); // an id, written as one
    expect(links('AURELIA')).toEqual([]);
  });

  it('links each entity once per document but keeps explicit links', () => {
    const linked = new Set<string>();
    expect(links('Veyr, Veyr, and again Veyr.', { linked })).toEqual(['name:veyr']);
    expect(links('More Veyr here', { linked })).toEqual([]); // same document: already linked
    expect(links('[[veyr]] and [[veyr]]')).toEqual(['wiki:veyr', 'wiki:veyr']);
  });

  it('never links an entity to itself automatically', () => {
    expect(links('Aurelia is Aurelia', { selfId: 'aurelia' })).toEqual([]);
  });

  it('skips ambiguous names but still links their ids', () => {
    expect(links('Twin')).toEqual([]);
    expect(links('twin-a')).toEqual(['id:twin-a']);
  });

  it('reports every known entity a text refers to', () => {
    expect([...resolver.references('Aurelia, [[veyr]], house-valen, [[ghost]]')].sort()).toEqual(['aurelia', 'house-valen', 'veyr']);
  });

  it('lists explicit targets, known or not', () => {
    expect(explicitTargets('[[a-b]] and [[c|d]] and [not-a-link]')).toEqual(['a-b', 'c']);
  });

  it('flattens to plain text for snippets', () => {
    expect(resolver.plain('**Bold** [[house-valen]] and [[aurelia|the city]].')).toBe('Bold House Valen and the city.');
  });
});
