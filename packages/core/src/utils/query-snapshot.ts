import type { QuerySnapshot, QuerySnapshotFilterToken, QuerySnapshotFreeTextToken } from '../types';

export const EMPTY_SNAPSHOT: QuerySnapshot = { segments: [], text: '' };

export const getFilterTokens = (snapshot: QuerySnapshot): QuerySnapshotFilterToken[] =>
  snapshot.segments.filter((s): s is QuerySnapshotFilterToken => s.type === 'filter');

export const getFreeTextTokens = (snapshot: QuerySnapshot): QuerySnapshotFreeTextToken[] =>
  snapshot.segments.filter((s): s is QuerySnapshotFreeTextToken => s.type === 'freeText');

/**
 * Get all tokens (filter + freeText) from a snapshot.
 * Used for onTokensChange comparison to track changes in both token types.
 */
export const getAllTokens = (
  snapshot: QuerySnapshot
): (QuerySnapshotFilterToken | QuerySnapshotFreeTextToken)[] =>
  snapshot.segments.filter(
    (s): s is QuerySnapshotFilterToken | QuerySnapshotFreeTextToken =>
      s.type === 'filter' || s.type === 'freeText'
  );

export const getPlainText = (snapshot: QuerySnapshot): string =>
  snapshot.segments
    .filter((s) => s.type === 'plaintext')
    .map((s) => s.value)
    .join('');
