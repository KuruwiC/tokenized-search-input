import type { Transaction } from '@tiptap/pm/state';
import { isEmptyToken, isToken } from '../../utils/node-predicates';
import { enterTokenIn, type FocusTransitionContext, programEntry } from '../token-focus';

/**
 * Undo and redo can restore a token without a value. Focusing the first such token
 * that can be edited lets the user fill it in, or leave it and have it removed.
 */
export function focusRestoredEmptyToken(tr: Transaction, focus: FocusTransitionContext): boolean {
  let id: string | null = null;
  tr.doc.descendants((node) => {
    if (id !== null) return false;
    if (isToken(node) && isEmptyToken(node) && node.attrs.immutable !== true) {
      id = String(node.attrs.id);
    }
    return !isToken(node);
  });
  if (id === null) return false;
  return enterTokenIn(tr, focus, id, programEntry());
}
