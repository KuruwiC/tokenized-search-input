import type { QuerySnapshot, QuerySnapshotFilterToken, QuerySnapshotFreeTextToken } from '../types';

export const EMPTY_SNAPSHOT: QuerySnapshot = { segments: [], text: '' };

export const getFilterTokens = (snapshot: QuerySnapshot): QuerySnapshotFilterToken[] =>
  snapshot.segments.filter((s): s is QuerySnapshotFilterToken => s.type === 'filter');

export const getFreeTextTokens = (snapshot: QuerySnapshot): QuerySnapshotFreeTextToken[] =>
  snapshot.segments.filter((s): s is QuerySnapshotFreeTextToken => s.type === 'freeText');

export const getPlainText = (snapshot: QuerySnapshot): string =>
  snapshot.segments
    .filter((s) => s.type === 'plaintext')
    .map((s) => s.value)
    .join('');
