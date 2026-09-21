/**
 * What to write when saving over an existing location file.
 *
 * Re-tracing a shape should change its outline (and whatever else the tool sets)
 * without wiping the things the tool doesn't know about: the summary you wrote,
 * a custom colour, a label position. So when the type is unchanged, existing
 * fields are kept and only the incoming ones replace them. If the type changed
 * (say a city became a region) the old fields no longer make sense, so the file
 * is written fresh.
 *
 * No imports: the dev server (Node) loads this too.
 */
export function mergeLocation(
  existing: Record<string, unknown> | null,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing || existing.type !== incoming.type) return incoming;
  return { ...existing, ...incoming };
}
