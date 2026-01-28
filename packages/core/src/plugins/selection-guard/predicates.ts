/**
 * Predicate functions for selection guard keyboard handlers.
 */

import { TextSelection } from '@tiptap/pm/state';
import type { Predicate } from '../../keyboard';
import { isSpacer, isToken } from '../../utils/node-predicates';
import { safeResolve } from '../../utils/safe-resolve';
import { tokenFocusKey } from '../token-focus-plugin';
import type { SelectionGuardContext } from './types';

/**
 * True if selection is empty (cursor, no range).
 */
export const isEmptySelection: Predicate<SelectionGuardContext> = (ctx) => ctx.selection.empty;

/**
 * True if selection is a TextSelection.
 */
export const isTextSelection: Predicate<SelectionGuardContext> = (ctx) =>
  ctx.selection instanceof TextSelection;

/**
 * True if Shift key is pressed.
 */
export const hasShiftKey: Predicate<SelectionGuardContext> = (ctx) => ctx.event.shiftKey;

/**
 * True if node before cursor is a spacer.
 */
export const nodeBeforeIsSpacer: Predicate<SelectionGuardContext> = (ctx) =>
  ctx.nodeBefore !== null && isSpacer(ctx.nodeBefore);

/**
 * True if node before cursor is a token.
 */
export const nodeBeforeIsToken: Predicate<SelectionGuardContext> = (ctx) =>
  ctx.nodeBefore !== null && isToken(ctx.nodeBefore);

/**
 * True if node after cursor is a spacer.
 */
export const nodeAfterIsSpacer: Predicate<SelectionGuardContext> = (ctx) =>
  ctx.nodeAfter !== null && isSpacer(ctx.nodeAfter);

/**
 * True if node after cursor is a token.
 */
export const nodeAfterIsToken: Predicate<SelectionGuardContext> = (ctx) =>
  ctx.nodeAfter !== null && isToken(ctx.nodeAfter);

/**
 * True if no token is currently focused (edit mode).
 */
export const tokenNotFocused: Predicate<SelectionGuardContext> = (ctx) => {
  const focusState = tokenFocusKey.getState(ctx.view.state);
  return focusState?.focusedPos === null || focusState?.focusedPos === undefined;
};

/**
 * True if there's a spacer before cursor with a token before that.
 */
export const hasTokenBeforeSpacer: Predicate<SelectionGuardContext> = (ctx) => {
  if (!ctx.nodeBefore || !isSpacer(ctx.nodeBefore)) return false;
  const beforeSpacer = ctx.selection.from - ctx.nodeBefore.nodeSize;
  const $beforeSpacer = safeResolve(ctx.doc, beforeSpacer);
  const nodeBefore = $beforeSpacer?.nodeBefore;
  return nodeBefore !== null && nodeBefore !== undefined && isToken(nodeBefore);
};

/**
 * True if there's a spacer after cursor with a token after that.
 */
export const hasTokenAfterSpacer: Predicate<SelectionGuardContext> = (ctx) => {
  if (!ctx.nodeAfter || !isSpacer(ctx.nodeAfter)) return false;
  const afterSpacer = ctx.selection.from + ctx.nodeAfter.nodeSize;
  const $afterSpacer = safeResolve(ctx.doc, afterSpacer);
  const nodeAfter = $afterSpacer?.nodeAfter;
  return nodeAfter !== null && nodeAfter !== undefined && isToken(nodeAfter);
};
