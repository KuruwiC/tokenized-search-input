import type { Editor } from '@tiptap/core';
import type { RefObject } from 'react';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import type { QuerySnapshotFilterToken } from '../../types';
import { findTokenById } from '../../utils/find-token';

/** The filter tokens of the input's current snapshot, in document order. */
export function filterTokens(
  ref: RefObject<TokenizedSearchInputRef | null>
): QuerySnapshotFilterToken[] {
  return (ref.current?.getSnapshot().segments ?? []).filter(
    (segment): segment is QuerySnapshotFilterToken => segment.type === 'filter'
  );
}

export const invalidTokenCount = () =>
  document.querySelectorAll('.node-filterToken [data-invalid="true"]').length;

export function tokenPos(editor: Editor, id: string): number {
  const found = findTokenById(editor.state.doc, id);
  if (!found) throw new Error(`token ${id} not found`);
  return found.pos;
}
