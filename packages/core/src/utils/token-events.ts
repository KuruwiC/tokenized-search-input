import type { QuerySnapshotFilterToken, QuerySnapshotFreeTextToken } from '../types';

/** A token as `onTokensChange` compares it. */
export type ComparableToken = QuerySnapshotFilterToken | QuerySnapshotFreeTextToken;

function isSameToken(a: ComparableToken, b: ComparableToken): boolean {
  if (a.type === 'filter' && b.type === 'filter') {
    return a.id === b.id && a.key === b.key && a.operator === b.operator && a.value === b.value;
  }
  return a.type === b.type && a.id === b.id && a.value === b.value;
}

/**
 * Whether two token lists confirm the same tokens: the same type, id, key, operator
 * and value in the same order. The focused token is still being edited, so it is left
 * out of both lists.
 */
export function areConfirmedTokensEqual(
  prev: readonly ComparableToken[],
  next: readonly ComparableToken[],
  focusedId: string | null
): boolean {
  const confirmed = (tokens: readonly ComparableToken[]) =>
    focusedId === null ? tokens : tokens.filter((token) => token.id !== focusedId);
  const a = confirmed(prev);
  const b = confirmed(next);
  return a.length === b.length && a.every((token, index) => isSameToken(token, b[index]));
}
