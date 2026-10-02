import type { Editor } from '@tiptap/core';
import { TextSelection, type Transaction } from '@tiptap/pm/state';
import { getEditorContext } from '../extensions/editor-context';
import { closeSuggestion } from '../plugins/suggestion-plugin';
import {
  canFocusToken,
  getFocusedToken,
  setTokenFocus,
  type TokenFocusEntry,
} from '../plugins/token-focus-plugin';
import { nearestValidCaret } from '../utils/caret';
import { findTokenById } from '../utils/find-token';
import { commitFilterToken } from './filter-token/token-actions';

/** Where the caret goes when focus leaves a token: beside it on that side, or nowhere new. */
export type LeaveDirection = 'left' | 'right' | 'none';

/**
 * Leaves the token `id` in `tr`: commits what the user entered, closes the token's
 * suggestion, clears the token focus and puts the caret beside the token on the
 * `direction` side. Leaving changes no query by itself, so unless the commit changed
 * the document the transaction stays out of the undo history.
 */
export function leaveTokenIn(
  tr: Transaction,
  editor: Editor,
  id: string,
  direction: LeaveDirection
): void {
  commitFilterToken(tr, id, getEditorContext(editor));
  closeSuggestion(tr);
  setTokenFocus(tr, null);

  const found = findTokenById(tr.doc, id);
  if (found && direction !== 'none') {
    const side = direction === 'right' ? 1 : -1;
    const pos = side > 0 ? found.pos + found.node.nodeSize : found.pos;
    tr.setSelection(TextSelection.create(tr.doc, nearestValidCaret(tr.doc, pos, side)));
  }
  if (!tr.docChanged) tr.setMeta('addToHistory', false);
}

/**
 * Moves the token focus into the token `id` in `tr`. A token focused before is left
 * first, in the same transaction, so it is committed whatever order the DOM focus
 * events come in.
 *
 * @returns whether the token received focus
 */
export function enterTokenIn(
  tr: Transaction,
  editor: Editor,
  id: string,
  entry: TokenFocusEntry
): boolean {
  if (!canFocusToken(tr.doc, id)) return false;
  const current = getFocusedToken(editor.state);
  if (current !== null && current.id !== id) leaveTokenIn(tr, editor, current.id, 'none');
  setTokenFocus(tr, { id, entry });
  if (!tr.docChanged) tr.setMeta('addToHistory', false);
  return true;
}

/** Moves the token focus into the token `id` in a transaction of its own. */
export function enterToken(editor: Editor, id: string, entry: TokenFocusEntry): boolean {
  const tr = editor.state.tr;
  if (!enterTokenIn(tr, editor, id, entry)) return false;
  editor.view.dispatch(tr);
  return true;
}
