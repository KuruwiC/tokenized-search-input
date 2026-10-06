import type { Transaction } from '@tiptap/pm/state';
import {
  type FocusTransitionContext,
  getValueReading,
  markOperatorRead,
} from '../../plugins/token-focus';
import { readOperator } from '../../serializer/read-word';
import { findTokenById } from '../../utils/find-token';
import { isFilterToken } from '../../utils/node-predicates';
import { resolveField } from '../../utils/resolve-field';
import { applyTokenAction } from './token-actions';

/**
 * The operator to read from `text` typed into the value of the filter token `id`, as the
 * query `key<d>text` reads it, or null when the text is the value. Read only while the text
 * follows the key directly and the token still has the field's first operator, which a key
 * without an operator gets.
 */
function operatorInText(
  tr: Transaction,
  ctx: FocusTransitionContext,
  delimiter: string,
  id: string,
  text: string
): { operator: string; rest: string } | null {
  if (getValueReading(ctx.state, id) !== 'pending') return null;
  const found = findTokenById(tr.doc, id);
  if (!found || !isFilterToken(found.node)) return null;
  const field = resolveField(ctx.source, String(found.node.attrs.key ?? ''));
  if (!field || found.node.attrs.operator !== field.operators[0]) return null;
  return readOperator(field, text, ctx.source, delimiter);
}

/**
 * Writes `text`, typed into the value of the focused filter token `id`, in `tr`. A leading
 * word the query reads as the operator, ended by the delimiter, becomes the operator and the
 * rest the value, in the same transaction and undo step as the keystroke that ended it. Text
 * still `composing` is written as the value, its operator read once it is committed.
 *
 * @returns whether the token changed
 */
export function writeTypedValue(
  tr: Transaction,
  ctx: FocusTransitionContext,
  delimiter: string,
  id: string,
  text: string,
  composing: boolean
): boolean {
  const read = composing ? null : operatorInText(tr, ctx, delimiter, id, text);
  if (!read) return applyTokenAction(tr, id, { type: 'setValue', value: text }, ctx.source);

  applyTokenAction(tr, id, { type: 'setOperator', operator: read.operator }, ctx.source);
  applyTokenAction(tr, id, { type: 'setValue', value: read.rest }, ctx.source);
  markOperatorRead(tr, ctx);
  return true;
}
