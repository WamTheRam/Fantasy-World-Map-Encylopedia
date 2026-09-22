/**
 * Writes a location as tidy, hand-editable JSON: fixed key order, one polygon
 * point per line, grouped by outline. Shared by the trace tool's "Copy JSON"
 * button and by the dev server that saves files, so both produce identical output.
 *
 * Deliberately has no imports: the dev server (Node) loads it too.
 */
const KEY_ORDER = ['id', 'name', 'type', 'parent', 'color', 'icon', 'coordinates', 'labelPosition', 'summary'];

const isXY = (v: unknown): v is { x: number; y: number } =>
  typeof v === 'object' &&
  v !== null &&
  Object.keys(v).length === 2 &&
  typeof (v as { x?: unknown }).x === 'number' &&
  typeof (v as { y?: unknown }).y === 'number';

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
  if (isXY(value)) return `{ "x": ${value.x}, "y": ${value.y} }`;
  return JSON.stringify(value);
}

export function formatLocationJson(data: Record<string, unknown>): string {
  const known = KEY_ORDER.filter((key) => key in data);
  const other = Object.keys(data).filter((key) => !KEY_ORDER.includes(key) && key !== 'polygons');
  const keys = [...known, ...other, ...('polygons' in data ? ['polygons'] : [])];
  const lines = keys.map((key) => `  ${JSON.stringify(key)}: ${formatValue(key, data[key])}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}
