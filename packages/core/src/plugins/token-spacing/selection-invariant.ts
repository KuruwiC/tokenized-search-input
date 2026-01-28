import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { isToken } from '../../utils/node-predicates';
import { safeResolve } from '../../utils/safe-resolve';
import type { CursorPosition } from '../token-focus-plugin';

export type SelectionAction =
  | { type: 'move'; pos: number }
  | { type: 'focus'; tokenPos: number; cursor: CursorPosition };

/**
 * Token position info when cursor is inside a token.
 */
export interface InsideTokenInfo {
  tokenPos: number;
  tokenEnd: number;
  isImmutable: boolean;
}

/**
 * Check if cursor is positioned inside a token (not at its boundary).
 * This can happen when ProseMirror's default behavior places cursor inside an atom node.
 *
 * @returns Token info if cursor is inside a token, null otherwise
 */
export function getCursorInsideToken(
  doc: ProseMirrorNode,
  cursorPos: number
): InsideTokenInfo | null {
  const $pos = safeResolve(doc, cursorPos);
  if (!$pos) return null;

  // Check parent at depth 1 (direct child of doc)
  // Tokens are inline nodes, so we need to check if we're inside one
  const depth = $pos.depth;

  for (let d = depth; d >= 1; d--) {
    const node = $pos.node(d);
    if (isToken(node)) {
      const tokenPos = $pos.before(d);
      const tokenEnd = $pos.after(d);
      const isImmutable = node.attrs.immutable === true;

      // Only report if cursor is truly inside (not at boundaries)
      if (cursorPos > tokenPos && cursorPos < tokenEnd) {
        return { tokenPos, tokenEnd, isImmutable };
      }
    }
  }

  return null;
}

/**
 * Selection Invariant Enforcer for Spacer architecture.
 *
 * INVARIANT: Cursor can be on a spacer, but entering a token requires explicit action.
 *
 * Behavior based on move direction:
 * - moveDirection > 0 (right): If cursor is directly before a token, focus it at start
 * - moveDirection < 0 (left): If cursor is directly after a token, focus it at end
 * - moveDirection = 0 (unknown/click): No action (spacer is a valid cursor position)
 *
 * Uses 'all' policy to navigate through all focusable elements (including delete button).
 *
 * @param doc - The document
 * @param cursorPos - Current cursor position
 * @param moveDirection - Positive = moving right, Negative = moving left, Zero = no direction
 * @returns Action to take (focus token), or null if no action needed
 */
export function enforceSelectionInvariant(
  doc: ProseMirrorNode,
  cursorPos: number,
  moveDirection: number
): SelectionAction | null {
  const $pos = safeResolve(doc, cursorPos);
  if (!$pos) return null;

  const nodeBefore = $pos.nodeBefore;
  const nodeAfter = $pos.nodeAfter;

  if (nodeAfter && isToken(nodeAfter)) {
    if (moveDirection > 0) {
      return {
        type: 'focus',
        tokenPos: cursorPos,
        cursor: { direction: 'from-left', policy: 'all' },
      };
    }
    return null;
  }

  if (nodeBefore && isToken(nodeBefore)) {
    if (moveDirection < 0) {
      return {
        type: 'focus',
        tokenPos: cursorPos - nodeBefore.nodeSize,
        cursor: { direction: 'from-right', policy: 'all' },
      };
    }
    return null;
  }

  return null;
}
