/**
 * Writes an entity as tidy, hand-editable JSON: fixed key order, one polygon
 * point per line, one relation per line. Shared by the trace tool's "Copy JSON"
 * button and by the dev server that saves files, so both produce identical output.
 *
 * Deliberately has no imports: the dev server (Node) loads it too.
 */
/**
 * Writes an entity as tidy, hand-editable JSON: fixed key order, one polygon
 * point per line (grouped by outline, since a location's territory can be
 * several disconnected polygons), one relation per line. Shared by the trace
 * tool's "Copy JSON" button and by the dev server that saves files, so both
 * produce identical output.
 *
 * Deliberately has no imports: the dev server (Node) loads it too.
 */
const KEY_ORDER = ['id', 'name', 'type', 'parent', 'year', 'order', 'color', 'icon', 'coordinates', 'labelPosition', 'summary', 'relations'];

const isXY = (v: unknown): v is { x: number; y: number } =>
  typeof v === 'object' &&
  v !== null &&
  Object.keys(v).length === 2 &&
  typeof (v as { x?: unknown }).x === 'number' &&
  typeof (v as { y?: unknown }).y === 'number';

const isRelation = (v: unknown): v is { label: string; target: string } =>
  typeof v === 'object' && v !== null && typeof (v as { label?: unknown }).label === 'string' && typeof (v as { target?: unknown }).target === 'string';

function formatPolygons(polygons: unknown[]): string {
  const rings = polygons.map((ring) => {
    if (!Array.isArray(ring)) return JSON.stringify(ring);
    const rows = ring.map((point) => `      ${JSON.stringify(point).replace(',', ', ')}`);
    return `    [\n${rows.join(',\n')}\n    ]`;
  });
  return `[\n${rings.join(',\n')}\n  ]`;
}

function formatValue(key: string, value: unknown): string {
  if (key === 'polygons' && Array.isArray(value)) return formatPolygons(value);
  if (key === 'relations' && Array.isArray(value) && value.length > 0 && value.every(isRelation)) {
    const rows = value.map((r) => `    { "label": ${JSON.stringify(r.label)}, "target": ${JSON.stringify(r.target)} }`);
    return `[\n${rows.join(',\n')}\n  ]`;
  }
  if (isXY(value)) return `{ "x": ${value.x}, "y": ${value.y} }`;
  return JSON.stringify(value);
}

export function formatEntityJson(data: Record<string, unknown>): string {
  const known = KEY_ORDER.filter((key) => key in data);
  const other = Object.keys(data).filter((key) => !KEY_ORDER.includes(key) && key !== 'polygons');
  const keys = [...known, ...other, ...('polygons' in data ? ['polygons'] : [])];
  const lines = keys.map((key) => `  ${JSON.stringify(key)}: ${formatValue(key, data[key])}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}
