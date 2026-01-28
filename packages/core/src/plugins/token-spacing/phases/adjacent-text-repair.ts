import type { Transaction } from '@tiptap/pm/state';
import { findAdjacentTextNodes } from '../helpers';
import type { DocumentRepairPhase, RepairContext } from '../types';

/**
 * Phase 4: Adjacent Text Node Repair
 *
 * INVARIANT: Adjacent text nodes must be separated by a space.
 * This handles cases where token deletion causes text nodes to become adjacent.
 */
export const adjacentTextRepairPhase: DocumentRepairPhase = {
  name: 'adjacentTextRepair',

  shouldRun({ docChanged }: RepairContext): boolean {
    return docChanged;
  },

  execute(tr: Transaction): boolean {
    const adjacentTextPositions = findAdjacentTextNodes(tr.doc);
    if (adjacentTextPositions.length === 0) return false;

    let modified = false;

    for (const pos of adjacentTextPositions.reverse()) {
      tr.insertText(' ', pos);
      modified = true;
    }

    return modified;
  },
};
