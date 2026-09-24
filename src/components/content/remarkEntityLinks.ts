import type { LinkResolver } from '@/lib/content/links';

/** The few fields of a Markdown syntax-tree node that this plugin needs. */
interface MdNode {
  type: string;
  value?: string;
  url?: string;
  title?: string | null;
  children?: MdNode[];
}

/** Places where turning words into links would be wrong or unwanted. */
const SKIP = new Set(['link', 'linkReference', 'inlineCode', 'code', 'heading', 'definition', 'html', 'image', 'imageReference']);

/**
 * A remark plugin that finds mentions of other entities in the text and turns
 * them into links with an `entity:<id>` address. The renderer then swaps those
 * for real router links (see `RichText`), so routes are never written into
 * content: an id is all a link needs.
 *
 * Headings, code and existing links are left alone. `linked` is shared across
 * the whole document, so an entity is auto-linked at its first mention only.
 * Pass an external `linked` Set in `options` to share that "first mention"
 * state across more than one document (e.g. an Overview block plus the article
 * below it); otherwise each call gets its own, scoped to just its own text.
 */
export function remarkEntityLinks(options: { resolver: LinkResolver; selfId?: string; linked?: Set<string> }) {
  return (tree: MdNode) => {
    const linked = options.linked ?? new Set<string>();

    const visit = (node: MdNode) => {
      if (!node.children || SKIP.has(node.type)) return;
      const next: MdNode[] = [];
      for (const child of node.children) {
        if (child.type === 'text' && child.value) {
          for (const segment of options.resolver.split(child.value, { selfId: options.selfId, linked })) {
            next.push(
              segment.kind === 'text'
                ? { type: 'text', value: segment.text }
                : { type: 'link', url: `entity:${segment.id}`, title: null, children: [{ type: 'text', value: segment.label }] },
            );
          }
        } else {
          visit(child);
          next.push(child);
        }
      }
      node.children = next;
    };

    visit(tree);
  };
}
