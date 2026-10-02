import type { Transaction } from '@tiptap/pm/state';
import { isToken } from '../../utils/node-predicates';
import { programEntry, setTokenFocus } from '../token-focus-plugin';
import { isEmptyToken } from './empty-token-cleanup';

/**
 * Undo and redo can restore a token without a value. Focusing the first such token
 * lets the user fill it in, or leave it and have it removed.
 */
export function focusRestoredEmptyToken(tr: Transaction): boolean {
  let id: string | null = null;
  tr.doc.descendants((node) => {
    if (id !== null) return false;
    if (isToken(node) && isEmptyToken(node)) id = String(node.attrs.id);
    return !isToken(node);
  });
  if (id === null) return false;
  return setTokenFocus(tr, { id, entry: programEntry() });
}
