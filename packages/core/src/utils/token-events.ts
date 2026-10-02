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
 * The confirmed form of `current`. The focused token is still being edited, so it keeps
 * the form it had in `confirmed`, the list confirmed before, or is left out when it was
 * not confirmed yet.
 */
export function confirmTokens(
  confirmed: readonly ComparableToken[],
  current: readonly ComparableToken[],
  focusedId: string | null
): readonly ComparableToken[] {
  if (focusedId === null) return current;
  return current.flatMap((token) => {
    if (token.id !== focusedId) return [token];
    const before = confirmed.find((candidate) => candidate.id === focusedId);
    return before ? [before] : [];
  });
}

/** Whether two token lists hold the same type, id, key, operator and value in the same order. */
export function areTokenListsEqual(
  a: readonly ComparableToken[],
  b: readonly ComparableToken[]
): boolean {
  return a.length === b.length && a.every((token, index) => isSameToken(token, b[index]));
}
