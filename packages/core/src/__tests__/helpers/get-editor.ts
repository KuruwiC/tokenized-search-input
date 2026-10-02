import type { Editor } from '@tiptap/core';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';

/** Reads the live TipTap editor through the ref's `getEditor()` escape hatch. */
export function getInternalEditor(ref: TokenizedSearchInputRef | null): Editor | null {
  return ref?.getEditor() ?? null;
}
