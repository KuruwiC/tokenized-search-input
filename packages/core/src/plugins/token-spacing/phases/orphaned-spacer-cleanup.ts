import type { Transaction } from '@tiptap/pm/state';
import { isSpacer } from '../../../utils/node-predicates';
import { applySpacerDeletion, checkBoundaryNeedsSpace, findOrphanedSpacers } from '../helpers';
import type { DocumentRepairPhase, RepairContext } from '../types';

/**
 * Phase 2: Orphaned Spacer Cleanup
 *
 * Removes spacers that have no adjacent tokens.
 * If a spacer is between two text nodes, replaces it with a space to maintain separation.
 */
export const orphanedSpacerCleanupPhase: DocumentRepairPhase = {
  name: 'orphanedSpacerCleanup',

  shouldRun({ docChanged }: RepairContext): boolean {
    return docChanged;
  },

  execute(tr: Transaction, { schema }: RepairContext): boolean {
    const orphanedSpacers = findOrphanedSpacers(tr.doc);
    if (orphanedSpacers.length === 0) return false;

    let modified = false;

    for (const pos of orphanedSpacers.reverse()) {
      const node = tr.doc.nodeAt(pos);
      if (!node || !isSpacer(node)) continue;

      const needsSpace = checkBoundaryNeedsSpace(tr.doc, pos, pos + node.nodeSize);
      applySpacerDeletion(tr, schema, {
        from: pos,
        to: pos + node.nodeSize,
        needsSpaceSeparator: needsSpace,
      });
      modified = true;
    }

    return modified;
  },
};
