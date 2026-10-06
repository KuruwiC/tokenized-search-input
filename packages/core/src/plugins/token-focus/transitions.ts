import { type EditorState, TextSelection, type Transaction } from '@tiptap/pm/state';
import { applyTokenAction, commitFilterToken } from '../../tokens/filter-token/token-actions';
import { nearestValidCaret } from '../../utils/caret';
import { findTokenById } from '../../utils/find-token';
import { isFilterToken } from '../../utils/node-predicates';
import type { FieldResolutionSource } from '../../utils/resolve-field';
import { closeSuggestion } from '../suggestion/actions';
import {
  canFocusToken,
  type FocusedToken,
  getFocusedToken,
  getTokenFocusMeta,
  setTokenFocus,
  type TokenFocusEntry,
  type ValueReading,
} from './state';

/**
 * What a focus transition needs besides the transaction: the state the transaction
 * starts from, how token keys resolve to fields, and whether the editor can be edited.
 */
export interface FocusTransitionContext {
  state: EditorState;
  source: FieldResolutionSource;
  editable: boolean;
}

/** Where the caret goes when focus leaves a token: beside it on that side, or nowhere new. */
export type LeaveDirection = 'left' | 'right' | 'none';

export interface LeaveOptions {
  /** Default: 'none'. */
  direction?: LeaveDirection;
  /** A value the user chose for the token, set as part of leaving it. */
  value?: string;
}

/** The token focused at this point of `tr`: as `tr` set it, or as it was before `tr`. */
function focusedIn(tr: Transaction, ctx: FocusTransitionContext): FocusedToken | null {
  const meta = getTokenFocusMeta(tr);
  return meta !== undefined ? meta.focused : getFocusedToken(ctx.state);
}

/**
 * Leaves the focused token, if there is one, in `tr`: sets `options.value` when given,
 * commits what the user entered, closes the token's suggestion, clears the token focus and puts the caret beside the
 * token on the `direction` side. Every way focus leaves a token goes through here. The
 * undo history records the commit with the rest of the transaction, and the repairs that
 * follow decide for themselves whether they are recorded.
 *
 * @returns the id of the token left, or null when no token was focused
 */
export function leaveFocusedTokenIn(
  tr: Transaction,
  ctx: FocusTransitionContext,
  options: LeaveOptions = {}
): string | null {
  const current = focusedIn(tr, ctx);
  if (current === null) return null;
  const { id } = current;

  if (options.value !== undefined) {
    applyTokenAction(tr, id, { type: 'setValue', value: options.value }, ctx.source);
  }
  commitFilterToken(tr, id, ctx.source);
  closeSuggestion(tr);
  setTokenFocus(tr, null);

  const found = findTokenById(tr.doc, id);
  const direction = options.direction ?? 'none';
  if (found && direction !== 'none') {
    const side = direction === 'right' ? 1 : -1;
    const pos = side > 0 ? found.pos + found.node.nodeSize : found.pos;
    tr.setSelection(TextSelection.create(tr.doc, nearestValidCaret(tr.doc, pos, side)));
  }
  return id;
}

/**
 * Leaves the token `id` in `tr` as {@link leaveFocusedTokenIn} does, when it is the
 * focused token.
 *
 * @returns whether the token was left
 */
export function leaveTokenIn(
  tr: Transaction,
  ctx: FocusTransitionContext,
  id: string,
  options: LeaveOptions = {}
): boolean {
  if (focusedIn(tr, ctx)?.id !== id) return false;
  leaveFocusedTokenIn(tr, ctx, options);
  return true;
}

/**
 * Moves the token focus into the token `id` in `tr`, leaving the token focused before,
 * if another one is, first. A token that cannot receive focus, or any token while the
 * editor cannot be edited, does not get it, and `tr` is left as it was.
 *
 * @returns whether the token received focus
 */
export function enterTokenIn(
  tr: Transaction,
  ctx: FocusTransitionContext,
  id: string,
  entry: TokenFocusEntry
): boolean {
  if (!ctx.editable || !canFocusToken(tr.doc, id)) return false;
  const current = focusedIn(tr, ctx);
  if (current !== null && current.id !== id) leaveFocusedTokenIn(tr, ctx);
  setTokenFocus(tr, { id, entry, valueReading: entryReading(tr, id) });
  return true;
}

function entryReading(tr: Transaction, id: string): ValueReading {
  const found = findTokenById(tr.doc, id);
  const empty = found !== null && isFilterToken(found.node) && !found.node.attrs.value;
  return empty ? 'pending' : 'none';
}

export function getValueReading(state: EditorState, id: string): ValueReading | null {
  const focused = getFocusedToken(state);
  return focused?.id === id ? focused.valueReading : null;
}

export function markOperatorRead(tr: Transaction, ctx: FocusTransitionContext): void {
  const current = focusedIn(tr, ctx);
  if (current !== null) setTokenFocus(tr, { ...current, valueReading: 'read' });
}
