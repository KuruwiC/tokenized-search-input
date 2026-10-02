/**
 * Predicate functions for selection guard keyboard handlers.
 */

import { TextSelection } from '@tiptap/pm/state';
import type { Predicate } from '../../keyboard';
import { isToken } from '../../utils/node-predicates';
import { getFocusedToken } from '../token-focus-plugin';
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
 * True if node before cursor is a token.
 */
export const nodeBeforeIsToken: Predicate<SelectionGuardContext> = (ctx) =>
  ctx.nodeBefore !== null && isToken(ctx.nodeBefore);

/**
 * True if node after cursor is a token.
 */
export const nodeAfterIsToken: Predicate<SelectionGuardContext> = (ctx) =>
  ctx.nodeAfter !== null && isToken(ctx.nodeAfter);

/**
 * True if no token is currently focused (edit mode).
 */
export const tokenNotFocused: Predicate<SelectionGuardContext> = (ctx) =>
  getFocusedToken(ctx.view.state) === null;
