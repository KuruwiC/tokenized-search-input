import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { isToken } from '../../../utils/node-predicates';
import { setTokenFocus } from '../../token-focus-plugin';
import type { DocumentRepairPhase, RepairContext } from '../types';

/**
 * Phase: History Empty Token Focus
 *
 * Undo/redo may restore empty tokens (tokens with no value).
 * Without intervention, these become orphaned and confusing.
 * This phase focuses the first empty token so the user can:
 * - Continue editing (fill in a value)
 * - Or navigate away (triggering emptyTokenCleanupPhase)
 */
export const historyEmptyTokenFocusPhase: DocumentRepairPhase = {
  name: 'historyEmptyTokenFocus',

  shouldRun({ isHistoryOperation, docChanged }: RepairContext): boolean {
    return isHistoryOperation && docChanged;
  },

  execute(tr: Transaction, _context: RepairContext): boolean {
    const emptyTokenPos = findFirstEmptyToken(tr.doc);
    if (emptyTokenPos === null) return false;

    setTokenFocus(tr, { focusedPos: emptyTokenPos, cursorPosition: 'end' });
    return true;
  },
};

function findFirstEmptyToken(doc: ProseMirrorNode): number | null {
  let result: number | null = null;
  doc.descendants((node, pos) => {
    if (result !== null) return false;
    if (isToken(node) && !node.attrs.value) {
      result = pos;
      return false;
    }
    return true;
  });
  return result;
}
