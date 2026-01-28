import type { QuerySnapshotFilterToken } from '../types';

/**
 * Compare two filter token lists to determine if there are changes.
 * Only compares id, operator, and value (ignores other attrs like invalid).
 */
export function areFilterTokenListsEqual(
  prev: QuerySnapshotFilterToken[],
  next: QuerySnapshotFilterToken[]
): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const p = prev[i];
    const n = next[i];
    if (p.id !== n.id || p.operator !== n.operator || p.value !== n.value) {
      return false;
    }
  }
  return true;
}

/**
 * Compare two filter token lists, excluding the focused token from BOTH lists.
 * This approach correctly handles:
 * - Token creation: fires when focus leaves
 * - Token editing: no fire during edit, fires when focus leaves
 * - Token deletion: fires immediately
 * - Re-focusing a token: no spurious fire
 */
export function areFilterTokenListsEqualExcludingFocused(
  prev: QuerySnapshotFilterToken[],
  next: QuerySnapshotFilterToken[],
  focusedTokenId: string | null
): boolean {
  // Filter out focused token from both lists
  const prevFiltered = focusedTokenId ? prev.filter((t) => t.id !== focusedTokenId) : prev;
  const nextFiltered = focusedTokenId ? next.filter((t) => t.id !== focusedTokenId) : next;

  return areFilterTokenListsEqual(prevFiltered, nextFiltered);
}
