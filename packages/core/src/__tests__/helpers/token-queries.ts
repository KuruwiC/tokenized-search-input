import type { RefObject } from 'react';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import type { QuerySnapshotFilterToken } from '../../types';

/** The filter tokens of the input's current snapshot, in document order. */
export function filterTokens(ref: RefObject<TokenizedSearchInputRef>): QuerySnapshotFilterToken[] {
  return (ref.current?.getSnapshot().segments ?? []).filter(
    (segment): segment is QuerySnapshotFilterToken => segment.type === 'filter'
  );
}

/** How many rendered tokens are marked invalid. */
export const invalidTokenCount = () =>
  document.querySelectorAll('.node-filterToken [data-invalid="true"]').length;
