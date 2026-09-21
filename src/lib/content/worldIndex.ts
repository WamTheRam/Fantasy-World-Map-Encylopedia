import { interiorLabelPoint, pointsBounds, polygonToPath, type Bounds } from '@/lib/map/geometry';
import {
  isArea,
  type AtlasLocation,
  type Entity,
  type HistoryEvent,
  type LoreEntity,
  type LoreType,
  type Point,
  type Relation,
  type WorldConfig,
} from '@/types/world';
import { LinkResolver } from './links';
import { compareEvents } from './timeline';

export interface Backlink {
  /** The entity that mentions this one. */
  id: string;
  /** The relation's label from that entity's point of view ("Ruler of"), when there is one. */
  label?: string;
}

/**
 * Read-only lookup structure over the validated world.
 *
 * Geography (parents, children, bounds) is answered here, and so is everything
 * about links between entities of any kind: resolving ids, backlinks, which
 * Markdown belongs to whom. Components never walk raw data themselves.
 */
export class WorldIndex {
  readonly world: WorldConfig;
  /** Places only. Use `entity(id)` to look up anything. */
  readonly locations: readonly AtlasLocation[];
  readonly lore: readonly LoreEntity[];
  readonly events: readonly HistoryEvent[];

  private readonly byId = new Map<string, AtlasLocation>();
  private readonly everything = new Map<string, Entity>();
  private readonly markdown: ReadonlyMap<string, string>;
  private readonly childrenByParent = new Map<string | null, AtlasLocation[]>();
  private readonly derived = new Map<string, { bounds: Bounds; labelPoint: Point; svgPath: string | null }>();
  private resolver: LinkResolver | null = null;
  private backlinkMap: Map<string, Map<string, Backlink>> | null = null;

  constructor(
    world: WorldConfig,
    locations: readonly AtlasLocation[],
    lore: readonly LoreEntity[] = [],
    events: readonly HistoryEvent[] = [],
    markdown: ReadonlyMap<string, string> = new Map(),
  ) {
    this.world = world;
    this.locations = locations;
    this.lore = lore;
    this.events = [...events].sort(compareEvents);
    this.markdown = markdown;

    for (const location of locations) {
      this.byId.set(location.id, location);
      const siblings = this.childrenByParent.get(location.parent) ?? [];
      siblings.push(location);
      this.childrenByParent.set(location.parent, siblings);
    }
    // Stable, predictable ordering in lists.
    for (const list of this.childrenByParent.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    for (const entity of [...locations, ...lore, ...events]) this.everything.set(entity.id, entity);
  }

  // ---- places ---------------------------------------------------------------

  get(id: string): AtlasLocation | undefined {
    return this.byId.get(id);
  }

  require(id: string): AtlasLocation {
    const location = this.byId.get(id);
    if (!location) throw new Error(`Unknown location id "${id}"`);
    return location;
  }

  countries(): AtlasLocation[] {
    return this.childrenOf(null).filter((l) => l.type === 'country');
  }

  /** Direct children. `null` returns the top level (countries). */
  childrenOf(id: string | null): AtlasLocation[] {
    return this.childrenByParent.get(id) ?? [];
  }

  descendantsOf(id: string): AtlasLocation[] {
    const result: AtlasLocation[] = [];
    const stack = [...this.childrenOf(id)];
    while (stack.length) {
      const next = stack.shift()!;
      result.push(next);
      stack.push(...this.childrenOf(next.id));
    }
    return result;
  }

  /** Parents from the top of the hierarchy down, not including the location itself. */
  ancestorsOf(id: string): AtlasLocation[] {
    const chain: AtlasLocation[] = [];
    let current = this.require(id);
    while (current.parent) {
      current = this.require(current.parent);
      chain.unshift(current);
    }
    return chain;
  }

  /** Ancestors plus the location itself: exactly the breadcrumb trail after "World". */
  chainTo(id: string): AtlasLocation[] {
    return [...this.ancestorsOf(id), this.require(id)];
  }

  boundsOf(id: string): Bounds {
    return this.derivedFor(id).bounds;
  }

  /** Where to anchor a label or focus the camera: the polygon's interior point, or the marker itself. */
  labelPointOf(id: string): Point {
    return this.derivedFor(id).labelPoint;
  }

  /** SVG path data for an area. Cached, since it never changes. */
  svgPathOf(id: string): string {
    const path = this.derivedFor(id).svgPath;
    if (path === null) throw new Error(`"${id}" is not an area and has no outline`);
    return path;
  }

  // ---- every kind of entity -------------------------------------------------

  /** Anything with an id: a place, person, faction, deity, event... */
  entity(id: string): Entity | undefined {
    return this.everything.get(id);
  }

  requireEntity(id: string): Entity {
    const entity = this.everything.get(id);
    if (!entity) throw new Error(`Unknown entity id "${id}"`);
    return entity;
  }

  allEntities(): Entity[] {
    return [...this.everything.values()];
  }

  /** Entries of one encyclopedia section, alphabetically. */
  loreOfType(type: LoreType): LoreEntity[] {
    return this.lore.filter((e) => e.type === type).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The long-form Markdown for an entity, if it has a content file. */
  markdownOf(id: string): string | undefined {
    return this.markdown.get(id);
  }

  relationsOf(id: string): Relation[] {
    return this.everything.get(id)?.relations ?? [];
  }

  /** Resolves ids and names in text to entities. Built once, on first use. */
  get links(): LinkResolver {
    this.resolver ??= new LinkResolver(this.allEntities().map((e) => ({ id: e.id, name: e.name })));
    return this.resolver;
  }

  /** Every entity that points at `id`, through a relation or by mentioning it in its text. */
  backlinksOf(id: string): Backlink[] {
    this.backlinkMap ??= this.buildBacklinks();
    return [...(this.backlinkMap.get(id)?.values() ?? [])].sort((a, b) =>
      (this.everything.get(a.id)?.name ?? '').localeCompare(this.everything.get(b.id)?.name ?? ''),
    );
  }

  private buildBacklinks(): Map<string, Map<string, Backlink>> {
    const map = new Map<string, Map<string, Backlink>>();
    const add = (target: string, source: string, label?: string) => {
      if (target === source || !this.everything.has(target)) return;
      const sources = map.get(target) ?? new Map<string, Backlink>();
      const existing = sources.get(source);
      if (!existing || (!existing.label && label)) sources.set(source, { id: source, label });
      map.set(target, sources);
    };
    for (const entity of this.everything.values()) {
      for (const relation of entity.relations ?? []) add(relation.target, entity.id, relation.label);
      for (const text of [entity.summary, this.markdown.get(entity.id)]) {
        if (text) for (const target of this.links.references(text)) add(target, entity.id);
      }
    }
    return map;
  }

  private derivedFor(id: string) {
    let cached = this.derived.get(id);
    if (!cached) {
      const location = this.require(id);
      if (isArea(location)) {
        cached = {
          bounds: pointsBounds(location.polygon),
          labelPoint: location.labelPosition ? [location.labelPosition.x, location.labelPosition.y] : interiorLabelPoint(location.polygon),
          svgPath: polygonToPath(location.polygon),
        };
      } else {
        const { x, y } = location.coordinates;
        cached = { bounds: { minX: x, minY: y, maxX: x, maxY: y }, labelPoint: [x, y], svgPath: null };
      }
      this.derived.set(id, cached);
    }
    return cached;
  }
}
