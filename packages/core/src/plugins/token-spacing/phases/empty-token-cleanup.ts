import type { Transaction } from '@tiptap/pm/state';
import { isToken } from '../../../utils/node-predicates';
import { getEmptyTokenAt } from '../helpers';
import type { DocumentRepairPhase, RepairContext } from '../types';

/**
 * Phase 1: Empty Token Cleanup
 *
 * Deletes empty tokens when focus moves away from them.
 */
export const emptyTokenCleanupPhase: DocumentRepairPhase = {
  name: 'emptyTokenCleanup',

  shouldRun({ focusChanged, oldFocusedPos }: RepairContext): boolean {
    return focusChanged && oldFocusedPos !== null;
  },

  execute(tr: Transaction, { oldFocusedPos }: RepairContext): boolean {
    const emptyTokenPos = getEmptyTokenAt(tr.doc, oldFocusedPos);
    if (emptyTokenPos === null) return false;

    const node = tr.doc.nodeAt(emptyTokenPos);
    if (!node || !isToken(node)) return false;

    tr.delete(emptyTokenPos, emptyTokenPos + node.nodeSize);

    return true;
  },
};
