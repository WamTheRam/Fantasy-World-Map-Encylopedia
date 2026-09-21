import { interiorLabelPoint, pointsBounds, polygonToPath, type Bounds } from '@/lib/map/geometry';
import { isArea, type AtlasLocation, type Point, type WorldConfig } from '@/types/world';

/**
 * Read-only lookup structure over the validated world.
 *
 * Everything the UI needs to know about relationships ("what's inside this
 * region?", "what's the breadcrumb trail for this city?") is answered here, so
 * components never walk the raw data themselves.
 */
export class WorldIndex {
  readonly world: WorldConfig;
  readonly locations: readonly AtlasLocation[];

  private readonly byId = new Map<string, AtlasLocation>();
  private readonly childrenByParent = new Map<string | null, AtlasLocation[]>();
  private readonly derived = new Map<string, { bounds: Bounds; labelPoint: Point; svgPath: string | null }>();

  constructor(world: WorldConfig, locations: readonly AtlasLocation[]) {
    this.world = world;
    this.locations = locations;

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
  }

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

  private derivedFor(id: string) {
    let cached = this.derived.get(id);
    if (!cached) {
      const location = this.require(id);
      if (isArea(location)) {
        cached = {
          bounds: pointsBounds(location.polygon),
          labelPoint: location.labelPosition
            ? [location.labelPosition.x, location.labelPosition.y]
            : interiorLabelPoint(location.polygon),
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
