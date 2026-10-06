/**
 * Offers `input` to `resolve` for every entry as given: entries whose id (an option's value, a
 * field's key) equals the input first, then the rest in order; the first non-null result wins.
 * So an exact id beats an earlier entry whose label the resolver also accepts; looser matches
 * (other case, prefix) follow entry order.
 */
export function resolveExactIdFirst<T>(
  entries: readonly T[],
  input: string,
  idOf: (entry: T) => string,
  resolve: (entry: T) => string | null
): string | null {
  const ordered = [
    ...entries.filter((entry) => idOf(entry) === input),
    ...entries.filter((entry) => idOf(entry) !== input),
  ];
  for (const entry of ordered) {
    const resolved = resolve(entry);
    if (resolved !== null) return resolved;
  }
  return null;
}
