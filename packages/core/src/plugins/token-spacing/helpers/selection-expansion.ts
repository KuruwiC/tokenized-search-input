/**
 * Helper functions for selection range expansion.
 *
 * Expands selection ranges to include complete token+spacer units,
 * preventing partial deletion of token/spacer pairs.
 */
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { isSpacer, isToken } from '../../../utils/node-predicates';

/**
 * Expand selection range to include complete token+spacer units.
 *
 * Used for range selection deletion to prevent partial token/spacer deletion.
 *
 * Unlike expandWithSpacers (for single token deletion), this function:
 * - Scans all spacers within the selection range
 * - Expands to include adjacent tokens that would be partially deleted
 * - Recursively includes those tokens' surrounding spacers
 *
 * @param doc - The ProseMirror document
 * @param from - Start of the selection range
 * @param to - End of the selection range
 * @returns Expanded range or null if no expansion needed
 */
export function expandSelectionForDeletion(
  doc: ProseMirrorNode,
  from: number,
  to: number
): { from: number; to: number } | null {
  let expandedFrom = from;
  let expandedTo = to;
  let needsExpansion = false;

  doc.nodesBetween(from, to, (node, pos) => {
    if (isSpacer(node)) {
      try {
        const $pos = doc.resolve(pos);
        const $endPos = doc.resolve(pos + node.nodeSize);
        const before = $pos.nodeBefore;
        const after = $endPos.nodeAfter;

        if (before && isToken(before)) {
          const tokenStart = pos - before.nodeSize;
          if (tokenStart < from) {
            try {
              const $tokenPos = doc.resolve(tokenStart);
              const leadingSpacer = $tokenPos.nodeBefore;
              if (leadingSpacer && isSpacer(leadingSpacer)) {
                expandedFrom = Math.min(expandedFrom, tokenStart - leadingSpacer.nodeSize);
              } else {
                expandedFrom = Math.min(expandedFrom, tokenStart);
              }
              needsExpansion = true;
            } catch {
              expandedFrom = Math.min(expandedFrom, tokenStart);
              needsExpansion = true;
            }
          }
        }

        if (after && isToken(after)) {
          const tokenEnd = pos + node.nodeSize + after.nodeSize;
          if (tokenEnd > to) {
            try {
              const $tokenEndPos = doc.resolve(tokenEnd);
              const trailingSpacer = $tokenEndPos.nodeAfter;
              if (trailingSpacer && isSpacer(trailingSpacer)) {
                expandedTo = Math.max(expandedTo, tokenEnd + trailingSpacer.nodeSize);
              } else {
                expandedTo = Math.max(expandedTo, tokenEnd);
              }
              needsExpansion = true;
            } catch {
              expandedTo = Math.max(expandedTo, tokenEnd);
              needsExpansion = true;
            }
          }
        }
      } catch {
        // Position resolution can fail at document boundaries
      }
    }
    return true;
  });

  return needsExpansion ? { from: expandedFrom, to: expandedTo } : null;
}
