/**
 * Handler functions for selection guard keyboard events.
 *
 * Each handler returns true if the event was handled.
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { KeyHandlerFn } from '../../keyboard';
import { isSpacer, isToken } from '../../utils/node-predicates';
import { safeResolve } from '../../utils/safe-resolve';
import { setTokenFocus } from '../token-focus-plugin';
import { enforceSelectionInvariant, type SelectionAction } from '../token-spacing-plugin';
import type { SelectionGuardContext } from './types';
import { markAsGuarded } from './utils';

type EntryDirection = 'from-left' | 'from-right';

/**
 * Handle token entry for Delete/Backspace keys.
 * For immutable tokens: creates a TextSelection covering the token (same as drag selection).
 *   - This enables 2-stage deletion: first press selects, second press deletes via existing range deletion.
 *   - Cmd+C/Cmd+X work automatically via existing ClipboardSerializer.
 * For normal tokens: enters editing mode.
 *
 * @returns true if handled
 */
function handleTokenEntry(
  view: EditorView,
  tokenNode: ProseMirrorNode,
  tokenPos: number,
  direction: EntryDirection
): boolean {
  const tr = view.state.tr;
  const isImmutable = tokenNode.attrs.immutable === true;

  if (isImmutable) {
    // Create TextSelection covering the token (same as drag selection)
    // This unifies immutable token selection with regular range selection,
    // enabling existing ClipboardSerializer, decorations, and delete handling to work.
    const tokenEnd = tokenPos + tokenNode.nodeSize;
    tr.setSelection(TextSelection.create(tr.doc, tokenPos, tokenEnd));
    view.focus();
    view.dispatch(markAsGuarded(tr));
    return true;
  }

  // Normal token: enter editing mode
  setTokenFocus(tr, {
    focusedPos: tokenPos,
    cursorPosition: { direction, policy: 'entry' },
  });
  view.dispatch(markAsGuarded(tr));
  return true;
}

/**
 * Find the next selectable position, skipping over ALL consecutive Spacers.
 */
function findNextSelectablePosition(
  doc: ProseMirrorNode,
  currentPos: number,
  direction: number
): number {
  let pos = currentPos;

  if (direction > 0) {
    let $pos = safeResolve(doc, pos);
    if (!$pos) return currentPos;
    let nodeAfter = $pos.nodeAfter;

    // Skip all consecutive spacers
    while (nodeAfter && isSpacer(nodeAfter)) {
      pos = pos + nodeAfter.nodeSize;
      $pos = safeResolve(doc, pos);
      if (!$pos) return currentPos;
      nodeAfter = $pos.nodeAfter;
    }

    // Include the token if found
    if (nodeAfter && isToken(nodeAfter)) {
      return pos + nodeAfter.nodeSize;
    }

    return pos !== currentPos ? pos : currentPos;
  } else {
    let $pos = safeResolve(doc, pos);
    if (!$pos) return currentPos;
    let nodeBefore = $pos.nodeBefore;

    // Skip all consecutive spacers
    while (nodeBefore && isSpacer(nodeBefore)) {
      pos = pos - nodeBefore.nodeSize;
      $pos = safeResolve(doc, pos);
      if (!$pos) return currentPos;
      nodeBefore = $pos.nodeBefore;
    }

    // Include the token if found
    if (nodeBefore && isToken(nodeBefore)) {
      return pos - nodeBefore.nodeSize;
    }

    return pos !== currentPos ? pos : currentPos;
  }
}

/**
 * Apply a selection action to the view.
 */
function applyAction(ctx: SelectionGuardContext, action: SelectionAction): void {
  const tr = ctx.view.state.tr;

  if (action.type === 'move') {
    tr.setSelection(TextSelection.create(tr.doc, action.pos));
  } else {
    setTokenFocus(tr, {
      focusedPos: action.tokenPos,
      cursorPosition: action.cursor,
    });
  }

  ctx.view.dispatch(markAsGuarded(tr));
}

/**
 * Handle Shift+Arrow for range selection (skipping spacers).
 */
export const handleShiftArrowSelection: KeyHandlerFn<SelectionGuardContext> = (ctx) => {
  const sel = ctx.selection as TextSelection;
  const direction = ctx.event.key === 'ArrowRight' ? 1 : -1;
  const newHead = findNextSelectablePosition(ctx.doc, sel.head, direction);

  if (newHead !== sel.head) {
    ctx.event.preventDefault();
    const tr = ctx.view.state.tr;
    tr.setSelection(TextSelection.create(tr.doc, sel.anchor, newHead));
    ctx.view.dispatch(markAsGuarded(tr));
    return true;
  }
  return false;
};

/**
 * Handle Arrow keys for single cursor movement.
 */
export const handleArrowMove: KeyHandlerFn<SelectionGuardContext> = (ctx) => {
  const direction = ctx.event.key === 'ArrowRight' ? 1 : -1;
  const nextPos = ctx.selection.from + direction;

  // Check bounds
  if (nextPos < 0 || nextPos > ctx.doc.content.size) {
    return false;
  }

  // Check if next position would be at a boundary
  const action = enforceSelectionInvariant(ctx.doc, nextPos, direction);
  if (action) {
    ctx.event.preventDefault();
    applyAction(ctx, action);
    return true;
  }

  return false;
};

/**
 * Handle Delete from spacer boundary - enter token from left.
 * Uses 'entry' policy to skip non-entry-focusable elements.
 * For immutable tokens, creates a TextSelection (same as drag selection).
 */
export const handleDeleteFromSpacer: KeyHandlerFn<SelectionGuardContext> = (ctx) => {
  if (!ctx.nodeAfter || !isSpacer(ctx.nodeAfter)) return false;

  const afterSpacer = ctx.selection.from + ctx.nodeAfter.nodeSize;
  const $afterSpacer = safeResolve(ctx.doc, afterSpacer);
  if (!$afterSpacer) return false;

  const tokenNode = $afterSpacer.nodeAfter;
  if (tokenNode && isToken(tokenNode)) {
    ctx.event.preventDefault();
    return handleTokenEntry(ctx.view, tokenNode, afterSpacer, 'from-left');
  }
  return false;
};

/**
 * Handle Delete when cursor is directly before a token.
 * Uses 'entry' policy to skip non-entry-focusable elements.
 * For immutable tokens, creates a TextSelection (same as drag selection).
 */
export const handleDeleteFromToken: KeyHandlerFn<SelectionGuardContext> = (ctx) => {
  if (!ctx.nodeAfter || !isToken(ctx.nodeAfter)) return false;

  ctx.event.preventDefault();
  return handleTokenEntry(ctx.view, ctx.nodeAfter, ctx.selection.from, 'from-left');
};

/**
 * Handle Backspace from spacer boundary - enter token from right.
 * Uses 'entry' policy to skip non-entry-focusable elements (like delete button).
 * For immutable tokens, creates a TextSelection (same as drag selection).
 */
export const handleBackspaceFromSpacer: KeyHandlerFn<SelectionGuardContext> = (ctx) => {
  if (!ctx.nodeBefore || !isSpacer(ctx.nodeBefore)) return false;

  const beforeSpacer = ctx.selection.from - ctx.nodeBefore.nodeSize;
  const $beforeSpacer = safeResolve(ctx.doc, beforeSpacer);
  if (!$beforeSpacer) return false;

  const tokenNode = $beforeSpacer.nodeBefore;
  if (tokenNode && isToken(tokenNode)) {
    ctx.event.preventDefault();
    const tokenPos = beforeSpacer - tokenNode.nodeSize;
    return handleTokenEntry(ctx.view, tokenNode, tokenPos, 'from-right');
  }
  return false;
};

/**
 * Handle Backspace when cursor is directly after a token.
 * Uses 'entry' policy to skip non-entry-focusable elements (like delete button).
 * For immutable tokens, creates a TextSelection (same as drag selection).
 */
export const handleBackspaceFromToken: KeyHandlerFn<SelectionGuardContext> = (ctx) => {
  if (!ctx.nodeBefore || !isToken(ctx.nodeBefore)) return false;

  ctx.event.preventDefault();
  const tokenPos = ctx.selection.from - ctx.nodeBefore.nodeSize;
  return handleTokenEntry(ctx.view, ctx.nodeBefore, tokenPos, 'from-right');
};
