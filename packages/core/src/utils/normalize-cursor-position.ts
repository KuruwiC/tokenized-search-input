/**
 * Normalize cursor position to a valid location.
 *
 * Ensures cursor is never placed inside a token or at invalid boundaries
 * (between token and spacer). Valid positions are:
 * - Between two spacers
 * - At paragraph start (before first spacer)
 * - At paragraph end (after last spacer)
 *
 * Used for external position calculations (e.g., posAtCoords) that may
 * return positions inside tokens or at invalid boundaries.
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { isSpacer, isToken } from './node-predicates';
import { safeResolve } from './safe-resolve';

/**
 * Normalize a cursor position to ensure it's at a valid location.
 *
 * @param doc - The ProseMirror document
 * @param pos - The position to normalize
 * @returns Normalized position, or original position if already valid
 */
export function normalizeCursorPosition(doc: ProseMirrorNode, pos: number): number {
  const $pos = safeResolve(doc, pos);
  if (!$pos) return pos;

  const depth = $pos.depth;
  for (let d = depth; d >= 1; d--) {
    const node = $pos.node(d);
    if (isToken(node)) {
      const tokenPos = $pos.before(d);
      const tokenEnd = $pos.after(d);
      const distToStart = pos - tokenPos;
      const distToEnd = tokenEnd - pos;

      if (distToStart <= distToEnd) {
        return findValidPositionBefore(doc, tokenPos);
      }
      return findValidPositionAfter(doc, tokenEnd);
    }
  }

  const nodeBefore = $pos.nodeBefore;
  const nodeAfter = $pos.nodeAfter;
  const beforeIsSpacer = nodeBefore && isSpacer(nodeBefore);
  const afterIsSpacer = nodeAfter && isSpacer(nodeAfter);
  const beforeIsToken = nodeBefore && isToken(nodeBefore);
  const afterIsToken = nodeAfter && isToken(nodeAfter);

  if (beforeIsSpacer && afterIsSpacer) {
    return pos;
  }

  if (!nodeBefore && afterIsSpacer) {
    return pos;
  }

  if (beforeIsSpacer && !nodeAfter) {
    return pos;
  }

  if (beforeIsToken && afterIsSpacer && nodeAfter) {
    return pos + nodeAfter.nodeSize;
  }

  if (beforeIsSpacer && afterIsToken && nodeBefore) {
    return pos - nodeBefore.nodeSize;
  }

  if (afterIsToken && !beforeIsSpacer) {
    return findValidPositionBefore(doc, pos);
  }

  if (beforeIsToken && !afterIsSpacer) {
    return findValidPositionAfter(doc, pos);
  }

  return pos;
}

/**
 * Find a valid position before the given position.
 * Searches backward for a spacer or paragraph start.
 */
function findValidPositionBefore(doc: ProseMirrorNode, pos: number): number {
  const $pos = safeResolve(doc, pos);
  if (!$pos) return pos;

  const nodeBefore = $pos.nodeBefore;
  if (nodeBefore && isSpacer(nodeBefore)) {
    return pos - nodeBefore.nodeSize;
  }

  return $pos.start();
}

/**
 * Find a valid position after the given position.
 * Searches forward for a spacer or paragraph end.
 */
function findValidPositionAfter(doc: ProseMirrorNode, pos: number): number {
  const $pos = safeResolve(doc, pos);
  if (!$pos) return pos;

  const nodeAfter = $pos.nodeAfter;
  if (nodeAfter && isSpacer(nodeAfter)) {
    return pos + nodeAfter.nodeSize;
  }

  return $pos.end();
}
