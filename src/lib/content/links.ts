/**
 * Cross-references: turning mentions of other entities into links.
 *
 * Three things in a piece of text become links, all resolved through entity ids
 * (never hard-coded routes):
 *
 *   [[house-valen]]          explicit link, shows the entity's name
 *   [[house-valen|the House]] explicit link with your own wording
 *   house-valen  /  House Valen   a bare id, or an exact name, in running text
 *
 * Automatic links are added once per entity per document (the first mention),
 * so a page doesn't turn into a wall of links. Explicit links are always kept.
 * A name shared by two entities is ambiguous and is never auto-linked.
 *
 * A name that starts with "The" also matches without it ("The Sundering" is
 * found in "after the Sundering"), since that is how people write.
 */
export interface LinkTarget {
  id: string;
  name: string;
}

export type LinkSegment =
  | { kind: 'text'; text: string }
  | {
      kind: 'link';
      id: string;
      label: string;
      via: 'wiki' | 'id' | 'name';
      /** False when an explicit [[id]] doesn't match any entity. */
      known: boolean;
    };

const WIKI = /\[\[([a-z0-9]+(?:-[a-z0-9]+)*)(?:\|([^\]\n]+))?\]\]/g;
const MIN_TOKEN = 3;
/** Shortened forms ("Founding" for "The Founding") are only used when reasonably distinctive. */
const MIN_ALIAS = 5;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every id written as [[id]] or [[id|text]], known or not. Used to report broken links. */
export function explicitTargets(text: string): string[] {
  return [...text.matchAll(WIKI)].map((m) => m[1]);
}

export class LinkResolver {
  private readonly names = new Map<string, string>();
  private readonly tokens = new Map<string, { id: string; via: 'id' | 'name' }>();
  private readonly pattern: RegExp | null;

  constructor(targets: readonly LinkTarget[]) {
    const nameUses = new Map<string, number>();
    for (const t of targets) {
      this.names.set(t.id, t.name);
      nameUses.set(t.name, (nameUses.get(t.name) ?? 0) + 1);
    }
    for (const t of targets) {
      if (t.id.length >= MIN_TOKEN) this.tokens.set(t.id, { id: t.id, via: 'id' });
    }
    for (const t of targets) {
      const unambiguous = nameUses.get(t.name) === 1;
      if (unambiguous && t.name.length >= MIN_TOKEN && !this.tokens.has(t.name)) this.tokens.set(t.name, { id: t.id, via: 'name' });
    }

    const withoutArticle = (name: string) => name.replace(/^The\s+/, '');
    const aliasUses = new Map<string, number>();
    for (const t of targets) {
      const alias = withoutArticle(t.name);
      if (alias !== t.name) aliasUses.set(alias, (aliasUses.get(alias) ?? 0) + 1);
    }
    for (const t of targets) {
      const alias = withoutArticle(t.name);
      const usable = alias !== t.name && alias.length >= MIN_ALIAS && aliasUses.get(alias) === 1 && !nameUses.has(alias);
      if (usable && !this.tokens.has(alias)) this.tokens.set(alias, { id: t.id, via: 'name' });
    }

    const alternatives = [...this.tokens.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
    // Whole-token match: not glued to letters, digits, underscores or hyphens on either side.
    this.pattern = alternatives.length
      ? new RegExp(`(?<![\\p{L}\\p{N}_-])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}_-])`, 'gu')
      : null;
  }

  has(id: string): boolean {
    return this.names.has(id);
  }

  nameOf(id: string): string | undefined {
    return this.names.get(id);
  }

  /**
   * Splits text into plain and link segments.
   * `linked` remembers which entities already got an automatic link in this
   * document; pass the same set for every text fragment of one page.
   */
  split(text: string, options: { selfId?: string; linked?: Set<string> } = {}): LinkSegment[] {
    const { selfId, linked = new Set<string>() } = options;
    const out: LinkSegment[] = [];
    let last = 0;

    for (const match of text.matchAll(WIKI)) {
      const start = match.index ?? 0;
      this.autoLink(text.slice(last, start), out, selfId, linked);
      const id = match[1];
      out.push({ kind: 'link', id, label: match[2]?.trim() || this.names.get(id) || id, via: 'wiki', known: this.names.has(id) });
      linked.add(id);
      last = start + match[0].length;
    }
    this.autoLink(text.slice(last), out, selfId, linked);
    return out;
  }

  /** The known entities a text refers to, by any of the three routes. */
  references(text: string): Set<string> {
    const ids = new Set<string>();
    for (const segment of this.split(text)) {
      if (segment.kind === 'link' && segment.known) ids.add(segment.id);
    }
    return ids;
  }

  /** Text with links flattened to their labels, for previews and list snippets. */
  plain(text: string): string {
    return this.split(text)
      .map((s) => (s.kind === 'text' ? s.text : s.label))
      .join('')
      .replace(/[*_`#>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private autoLink(text: string, out: LinkSegment[], selfId: string | undefined, linked: Set<string>) {
    if (!text) return;
    if (!this.pattern) {
      out.push({ kind: 'text', text });
      return;
    }
    let last = 0;
    for (const match of text.matchAll(this.pattern)) {
      const hit = this.tokens.get(match[0]);
      if (!hit || hit.id === selfId || linked.has(hit.id)) continue;
      const start = match.index ?? 0;
      if (start > last) out.push({ kind: 'text', text: text.slice(last, start) });
      out.push({ kind: 'link', id: hit.id, label: hit.via === 'id' ? (this.names.get(hit.id) ?? hit.id) : match[0], via: hit.via, known: true });
      linked.add(hit.id);
      last = start + match[0].length;
    }
    if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  }
}
