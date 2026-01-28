/**
 * Spacer Boundary Check
 *
 * Functions for checking if space separation is needed at range boundaries.
 */
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { isText } from '../utils/node-predicates';
import { safeResolve } from '../utils/safe-resolve';

/**
 * Check if a range needs space separator by examining its actual boundaries.
 * Used after merging ranges to recompute based on final boundaries.
 */
export function checkBoundaryNeedsSpace(doc: ProseMirrorNode, from: number, to: number): boolean {
  const $from = safeResolve(doc, from);
  const $to = safeResolve(doc, to);
  if (!$from || !$to) return false;

  const hasTextBefore = $from.nodeBefore && isText($from.nodeBefore);
  const hasTextAfter = $to.nodeAfter && isText($to.nodeAfter);
  return !!(hasTextBefore && hasTextAfter);
}
