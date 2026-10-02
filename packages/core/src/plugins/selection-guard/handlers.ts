/**
 * Handler functions for selection guard keyboard events.
 *
 * Each handler returns true if the event was handled.
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { KeyHandlerFn } from '../../keyboard';
import { nearestValidCaret } from '../../utils/caret';
import { isToken } from '../../utils/node-predicates';
import { safeResolve } from '../../utils/safe-resolve';
import { setTokenFocus } from '../token-focus-plugin';
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

type Direction = -1 | 1;

function arrowDirection(ctx: SelectionGuardContext): Direction {
  return ctx.event.key === 'ArrowRight' ? 1 : -1;
}

function tokenInDirection(ctx: SelectionGuardContext, head: number, direction: Direction) {
  const $head = safeResolve(ctx.doc, head);
  const node = direction > 0 ? $head?.nodeAfter : $head?.nodeBefore;
  return node && isToken(node) ? node : null;
}

/**
 * Handle Shift+Arrow over a token: the selection grows by the whole token. Within text
 * the browser extends the selection itself.
 */
export const handleShiftArrowSelection: KeyHandlerFn<SelectionGuardContext> = (ctx) => {
  const sel = ctx.selection as TextSelection;
  const direction = arrowDirection(ctx);
  const token = tokenInDirection(ctx, sel.head, direction);
  if (!token) return false;

  ctx.event.preventDefault();
  const head = nearestValidCaret(ctx.doc, sel.head + direction * token.nodeSize, direction);
  const tr = ctx.view.state.tr;
  tr.setSelection(TextSelection.create(tr.doc, sel.anchor, head));
  ctx.view.dispatch(markAsGuarded(tr));
  return true;
};

/**
 * Handle Arrow keys for single cursor movement: moving onto a token enters it from that
 * side. Within text the browser moves the caret itself.
 */
export const handleArrowMove: KeyHandlerFn<SelectionGuardContext> = (ctx) => {
  const direction = arrowDirection(ctx);
  const token = tokenInDirection(ctx, ctx.selection.from, direction);
  if (!token) return false;

  ctx.event.preventDefault();
  const tr = ctx.view.state.tr;
  setTokenFocus(tr, {
    focusedPos: direction > 0 ? ctx.selection.from : ctx.selection.from - token.nodeSize,
    cursorPosition: { direction: direction > 0 ? 'from-left' : 'from-right', policy: 'all' },
  });
  ctx.view.dispatch(markAsGuarded(tr));
  return true;
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
