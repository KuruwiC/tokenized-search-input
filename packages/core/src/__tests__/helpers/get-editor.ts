import { waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import type { RefObject } from 'react';
import { expect } from 'vitest';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';

/** Reads the live TipTap editor through the ref's `getEditor()` escape hatch. */
export function getInternalEditor(ref: TokenizedSearchInputRef | null): Editor | null {
  return ref?.getEditor() ?? null;
}

/** Resolves with the live editor once the input behind `ref` has created it. */
export async function waitForEditor(
  ref: RefObject<TokenizedSearchInputRef | null>
): Promise<Editor> {
  await waitFor(() => expect(getInternalEditor(ref.current)).not.toBeNull());
  const editor = getInternalEditor(ref.current);
  if (!editor) throw new Error('editor is unavailable');
  return editor;
}
