import type { Transaction } from '@tiptap/pm/state';
import { findMissingSpacers, insertSpacer } from '../helpers';
import type { DocumentRepairPhase, RepairContext } from '../types';

/**
 * Phase 3: Missing Spacer Repair
 *
 * INVARIANT: Every token must have a spacer on both sides.
 * This handles edge cases like range selection deletion that removes spacers.
 */
export const missingSpacerRepairPhase: DocumentRepairPhase = {
  name: 'missingSpacerRepair',

  shouldRun({ docChanged }: RepairContext): boolean {
    return docChanged;
  },

  execute(tr: Transaction, { schema }: RepairContext): boolean {
    const missingSpacers = findMissingSpacers(tr.doc);
    if (missingSpacers.length === 0) return false;

    let modified = false;

    for (const { pos } of missingSpacers.reverse()) {
      if (insertSpacer(tr, schema, pos)) {
        modified = true;
      }
    }

    return modified;
  },
};
