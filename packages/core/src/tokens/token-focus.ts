import type { Editor } from '@tiptap/core';
import { getFocusContext } from '../extensions/editor-context';
import { enterTokenIn, type TokenFocusEntry } from '../plugins/token-focus-plugin';

/** Moves the token focus into the token `id` in a transaction of its own. */
export function enterToken(editor: Editor, id: string, entry: TokenFocusEntry): boolean {
  const tr = editor.state.tr;
  if (!enterTokenIn(tr, getFocusContext(editor), id, entry)) return false;
  editor.view.dispatch(tr);
  return true;
}
