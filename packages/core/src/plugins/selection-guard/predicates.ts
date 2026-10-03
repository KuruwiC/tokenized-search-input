import { TextSelection } from '@tiptap/pm/state';
import { isToken } from '../../utils/node-predicates';
import { getFocusedToken } from '../token-focus';
import type { Predicate } from './types';

export const isEmptySelection: Predicate = (ctx) => ctx.selection.empty;

export const isTextSelection: Predicate = (ctx) => ctx.selection instanceof TextSelection;

export const hasShiftKey: Predicate = (ctx) => ctx.event.shiftKey;

export const nodeBeforeIsToken: Predicate = (ctx) =>
  ctx.nodeBefore !== null && isToken(ctx.nodeBefore);

export const nodeAfterIsToken: Predicate = (ctx) =>
  ctx.nodeAfter !== null && isToken(ctx.nodeAfter);

export const tokenNotFocused: Predicate = (ctx) => getFocusedToken(ctx.view.state) === null;
