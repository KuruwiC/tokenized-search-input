import type { Transaction } from '@tiptap/pm/state';
import { isToken } from '../../../utils/node-predicates';
import { applySpacerDeletion, expandWithSpacers, getEmptyTokenAt } from '../helpers';
import type { DocumentRepairPhase, RepairContext } from '../types';

/**
 * Phase 1: Empty Token Cleanup
 *
 * Deletes empty tokens when focus moves away from them.
 * With spacer architecture: deletes token + adjacent spacers.
 * If text nodes exist on both sides, replaces with space to maintain separation.
 */
export const emptyTokenCleanupPhase: DocumentRepairPhase = {
  name: 'emptyTokenCleanup',

  shouldRun({ focusChanged, oldFocusedPos }: RepairContext): boolean {
    return focusChanged && oldFocusedPos !== null;
  },

  execute(tr: Transaction, { oldFocusedPos, schema }: RepairContext): boolean {
    const emptyTokenPos = getEmptyTokenAt(tr.doc, oldFocusedPos);
    if (emptyTokenPos === null) return false;

    const node = tr.doc.nodeAt(emptyTokenPos);
    if (!node || !isToken(node)) return false;

    const range = expandWithSpacers(tr.doc, emptyTokenPos, node.nodeSize);
    applySpacerDeletion(tr, schema, range);

    return true;
  },
};
