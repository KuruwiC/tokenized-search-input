import type { QuerySnapshotFilterToken, QuerySnapshotFreeTextToken } from '../types';

/**
 * Union type for tokens that can be compared in onTokensChange.
 */
export type ComparableToken = QuerySnapshotFilterToken | QuerySnapshotFreeTextToken;

/**
 * Compare two token lists to determine if there are changes.
 * Compares type, id, value, and operator (for filter tokens only).
 */
export function areTokenListsEqual(prev: ComparableToken[], next: ComparableToken[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const p = prev[i];
    const n = next[i];
    if (p.type !== n.type) return false;
    if (p.id !== n.id) return false;
    if (p.value !== n.value) return false;
    if (p.type === 'filter' && n.type === 'filter') {
      if (p.operator !== n.operator) return false;
    }
  }
  return true;
}

/**
 * Compare two token lists, excluding the focused token from both lists.
 * Handles token creation/editing (fires on blur) and deletion (fires immediately).
 */
export function areTokenListsEqualExcludingFocused(
  prev: ComparableToken[],
  next: ComparableToken[],
  focusedTokenId: string | null
): boolean {
  const prevFiltered = focusedTokenId ? prev.filter((t) => t.id !== focusedTokenId) : prev;
  const nextFiltered = focusedTokenId ? next.filter((t) => t.id !== focusedTokenId) : next;
  return areTokenListsEqual(prevFiltered, nextFiltered);
}
