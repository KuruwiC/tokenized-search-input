import type { Transaction } from '@tiptap/pm/state';
import { isToken } from '../../utils/node-predicates';
import { setTokenFocus } from '../token-focus-plugin';
import { isEmptyToken } from './empty-token-cleanup';

/**
 * Undo and redo can restore a token without a value. Focusing the first such token
 * lets the user fill it in, or leave it and have it removed.
 */
export function focusRestoredEmptyToken(tr: Transaction): boolean {
  let focusedPos: number | null = null;
  tr.doc.descendants((node, pos) => {
    if (focusedPos !== null) return false;
    if (isToken(node) && isEmptyToken(node)) focusedPos = pos;
    return !isToken(node);
  });
  if (focusedPos === null) return false;
  setTokenFocus(tr, { focusedPos, cursorPosition: 'end' });
  return true;
}
