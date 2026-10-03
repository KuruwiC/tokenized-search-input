import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { nearestValidCaret } from '../../utils/caret';
import { isToken } from '../../utils/node-predicates';
import { safeResolve } from '../../utils/safe-resolve';
import { enterTokenIn, type TokenFocusEntry } from '../token-focus';
import type { KeyHandler, SelectionGuardContext } from './types';

/**
 * Enters a token from the keyboard. A token that cannot be edited, an immutable one,
 * is selected as a whole instead, as a drag would select it. A selected token is deleted by
 * the next Backspace/Delete as any range is, and the clipboard serializer handles
 * copy and cut of it.
 */
function handleTokenEntry(
  ctx: SelectionGuardContext,
  tokenNode: ProseMirrorNode,
  tokenPos: number,
  entry: TokenFocusEntry
): boolean {
  const { view } = ctx;
  const tr = view.state.tr;
  if (!enterTokenIn(tr, ctx.focus, String(tokenNode.attrs.id), entry)) {
    tr.setSelection(TextSelection.create(tr.doc, tokenPos, tokenPos + tokenNode.nodeSize));
    view.focus();
  }
  view.dispatch(tr);
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
 * Shift+Arrow over a token: the selection grows by the whole token. Within text
 * the browser extends the selection itself.
 */
export const handleShiftArrowSelection: KeyHandler = (ctx) => {
  const sel = ctx.selection as TextSelection;
  const direction = arrowDirection(ctx);
  const token = tokenInDirection(ctx, sel.head, direction);
  if (!token) return false;

  ctx.event.preventDefault();
  const head = nearestValidCaret(ctx.doc, sel.head + direction * token.nodeSize, direction);
  const tr = ctx.view.state.tr;
  tr.setSelection(TextSelection.create(tr.doc, sel.anchor, head));
  ctx.view.dispatch(tr);
  return true;
};

/**
 * Arrow key with a collapsed selection: moving onto a token enters it from that
 * side, at the block on that side. Within text the browser moves the caret itself.
 */
export const handleArrowMove: KeyHandler = (ctx) => {
  const direction = arrowDirection(ctx);
  const token = tokenInDirection(ctx, ctx.selection.from, direction);
  if (!token) return false;

  ctx.event.preventDefault();
  const tokenPos = direction > 0 ? ctx.selection.from : ctx.selection.from - token.nodeSize;
  return handleTokenEntry(ctx, token, tokenPos, {
    source: 'keyboard',
    position: direction > 0 ? 'start' : 'end',
    target: 'entry',
  });
};

/**
 * Delete with the caret directly before a token.
 * The token is entered as a whole, at its first entry-focusable block.
 */
export const handleDeleteFromToken: KeyHandler = (ctx) => {
  if (!ctx.nodeAfter || !isToken(ctx.nodeAfter)) return false;

  ctx.event.preventDefault();
  return handleTokenEntry(ctx, ctx.nodeAfter, ctx.selection.from, {
    source: 'keyboard',
    position: 'start',
    target: 'all',
  });
};

/**
 * Backspace with the caret directly after a token.
 * The token is entered as a whole, at its last entry-focusable block.
 */
export const handleBackspaceFromToken: KeyHandler = (ctx) => {
  if (!ctx.nodeBefore || !isToken(ctx.nodeBefore)) return false;

  ctx.event.preventDefault();
  const tokenPos = ctx.selection.from - ctx.nodeBefore.nodeSize;
  return handleTokenEntry(ctx, ctx.nodeBefore, tokenPos, {
    source: 'keyboard',
    position: 'end',
    target: 'all',
  });
};
