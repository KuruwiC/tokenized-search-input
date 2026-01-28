/**
 * Spacer Expansion Operations
 *
 * Pure functions for computing deletion ranges that include adjacent spacers.
 * Used by validation (plan-executor) and token-spacing (empty-token-cleanup).
 */
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { isSpacer, isText } from '../utils/node-predicates';
import { safeResolve } from '../utils/safe-resolve';
import type { SpacerExpandedRange } from './types';

/**
 * Expand deletion range to include adjacent spacers.
 * If text nodes exist on both sides, marks that a space separator is needed.
 *
 * Note: This function only checks for the presence of text nodes, not their content.
 * If neighboring text nodes already contain boundary whitespace (e.g., "hello " and " world"),
 * a separator space will still be inserted, potentially resulting in double spaces.
 * This is acceptable because:
 * 1. In the spacer architecture, text node boundaries typically don't have whitespace
 * 2. Such cases only occur from external input (paste, etc.) which can be normalized separately
 */
export function expandWithSpacers(
  doc: ProseMirrorNode,
  pos: number,
  nodeSize: number
): SpacerExpandedRange {
  let deleteFrom = pos;
  let deleteTo = pos + nodeSize;
  let hasLeadingSpacer = false;
  let hasTrailingSpacer = false;
  let hasTextBefore = false;
  let hasTextAfter = false;

  const $before = safeResolve(doc, pos);
  if ($before?.nodeBefore && isSpacer($before.nodeBefore)) {
    hasLeadingSpacer = true;
    deleteFrom = pos - $before.nodeBefore.nodeSize;

    const $beforeSpacer = safeResolve(doc, deleteFrom);
    if ($beforeSpacer?.nodeBefore && isText($beforeSpacer.nodeBefore)) {
      hasTextBefore = true;
    }
  }

  const $after = safeResolve(doc, pos + nodeSize);
  if ($after?.nodeAfter && isSpacer($after.nodeAfter)) {
    hasTrailingSpacer = true;
    deleteTo = pos + nodeSize + $after.nodeAfter.nodeSize;

    const $afterSpacer = safeResolve(doc, deleteTo);
    if ($afterSpacer?.nodeAfter && isText($afterSpacer.nodeAfter)) {
      hasTextAfter = true;
    }
  }

  const needsSpaceSeparator =
    hasTextBefore && hasTextAfter && hasLeadingSpacer && hasTrailingSpacer;

  return { from: deleteFrom, to: deleteTo, needsSpaceSeparator };
}
