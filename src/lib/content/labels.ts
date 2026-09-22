import { ICON_LABELS } from '@/lib/map/iconLabels';
import type { Entity } from '@/types/world';
import { categoryOfType } from './categories';

/** The short kind shown on badges and tooltips: "Country", "Capital", "Person", "Historical event". */
export function entityKindLabel(entity: Entity): string {
  switch (entity.type) {
    case 'country':
      return 'Country';
    case 'region':
      return 'Region';
    case 'island':
      return 'Island';
    case 'city':
    case 'poi':
      return ICON_LABELS[entity.icon ?? (entity.type === 'city' ? 'city' : 'other')];
    case 'event':
      return 'Historical event';
    default:
      return categoryOfType(entity.type).singular;
  }
}
