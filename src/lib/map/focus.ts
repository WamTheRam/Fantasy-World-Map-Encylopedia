import type { WorldIndex } from '@/lib/content/worldIndex';
import { isArea } from '@/types/world';
import { fitBounds, type Size, type View } from './viewport';

/** How much closer than its region's framing the camera sits on a selected city. */
const POINT_ZOOM = 1.35;

/** Extra clearance under the floating header (breadcrumbs, menu) so framed areas don't tuck beneath it. */
const HEADER_INSET = 32;

/**
 * Where the camera should go for a selection.
 *
 *   nothing  frame the whole world
 *   area     frame the polygon
 *   point    centre on the marker, a little closer than its region's framing
 */
export function computeFocusView(index: WorldIndex, selectedId: string | null, size: Size): View {
  const { width, height } = index.world.map;
  const padding = Math.min(56, Math.min(size.width, size.height) * 0.12);
  const worldView = fitBounds({ minX: 0, minY: 0, maxX: width, maxY: height }, size, padding / 2, HEADER_INSET);

  if (!selectedId) return worldView;

  const location = index.require(selectedId);
  if (isArea(location)) return fitBounds(index.boundsOf(location.id), size, padding, HEADER_INSET);

  const enclosing = [...index.ancestorsOf(location.id)].reverse().find(isArea);
  const areaView = enclosing ? fitBounds(index.boundsOf(enclosing.id), size, padding, HEADER_INSET) : worldView;
  const [x, y] = index.labelPointOf(location.id);
  return { cx: x, cy: y, s: areaView.s * POINT_ZOOM };
}
