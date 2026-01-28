import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { isSpacer, isToken } from '../../../utils/node-predicates';

/**
 * Find orphaned spacers in the document.
 * An orphaned spacer is one that has no adjacent token on either side.
 *
 * @returns Array of positions of orphaned spacers
 */
export function findOrphanedSpacers(doc: ProseMirrorNode): number[] {
  const orphaned: number[] = [];

  doc.descendants((node, pos) => {
    if (!isSpacer(node)) return true;

    try {
      const $pos = doc.resolve(pos);
      const $endPos = doc.resolve(pos + node.nodeSize);

      const before = $pos.nodeBefore;
      const after = $endPos.nodeAfter;

      const hasAdjacentToken = (before && isToken(before)) || (after && isToken(after));

      if (!hasAdjacentToken) {
        orphaned.push(pos);
      }
    } catch {
      // Position resolution can fail at document boundaries
    }

    return true;
  });

  return orphaned;
}

/**
 * Find tokens with missing adjacent spacers.
 *
 * INVARIANT: Every token must have a spacer on both sides.
 * This function detects violations where a spacer is missing.
 *
 * @returns Array of { pos, side } indicating where spacers need to be inserted
 */
export function findMissingSpacers(
  doc: ProseMirrorNode
): Array<{ pos: number; side: 'before' | 'after' }> {
  const missing: Array<{ pos: number; side: 'before' | 'after' }> = [];

  doc.descendants((node, pos) => {
    if (!isToken(node)) return true;

    try {
      const $pos = doc.resolve(pos);
      const $endPos = doc.resolve(pos + node.nodeSize);

      const before = $pos.nodeBefore;
      const after = $endPos.nodeAfter;

      if (!before || !isSpacer(before)) {
        missing.push({ pos, side: 'before' });
      }

      if (!after || !isSpacer(after)) {
        missing.push({ pos: pos + node.nodeSize, side: 'after' });
      }
    } catch {
      // Position resolution can fail at document boundaries
    }

    return true;
  });

  return missing;
}
