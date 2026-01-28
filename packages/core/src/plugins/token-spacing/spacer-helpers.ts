/**
 * Spacer Helper Functions
 *
 * Utilities for finding spacer positions around tokens.
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { isSpacer } from '../../utils/node-predicates';
import { safeResolve } from '../../utils/safe-resolve';

/**
 * Find the position inside the spacer before the given position.
 * Returns null if no spacer is found.
 */
export function findSpacerBefore(doc: ProseMirrorNode, pos: number): number | null {
  const $pos = safeResolve(doc, pos);
  if (!$pos) return null;

  const nodeBefore = $pos.nodeBefore;
  if (nodeBefore && isSpacer(nodeBefore)) {
    // Position inside the spacer (before the token)
    return pos - nodeBefore.nodeSize;
  }
  return null;
}

/**
 * Find the position inside the spacer after the given position.
 * Returns null if no spacer is found.
 */
export function findSpacerAfter(doc: ProseMirrorNode, pos: number): number | null {
  const $pos = safeResolve(doc, pos);
  if (!$pos) return null;

  const nodeAfter = $pos.nodeAfter;
  if (nodeAfter && isSpacer(nodeAfter)) {
    // Position after the spacer
    return pos + nodeAfter.nodeSize;
  }
  return null;
}
