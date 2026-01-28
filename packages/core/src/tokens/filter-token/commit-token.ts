import type { Transaction } from '@tiptap/pm/state';
import type { FieldDefinition } from '../../types';
import { isFilterToken } from '../../utils/node-predicates';
import { computeAttrsPatch, type TokenEditableAttrs, tokenAttrReducer } from './token-attr-reducer';

export interface CommitTokenOptions {
  tr: Transaction;
  pos: number;
  fieldDef: FieldDefinition | undefined;
  validate?: (value: string) => boolean | string;
}

/**
 * Commit a filter token: set confirmed, optionally mark immutable, and run validation.
 * This is the single source of truth for token confirmation logic.
 *
 * All attribute changes (confirmed, immutable, invalid) are applied directly
 * to the transaction, ensuring atomic updates.
 *
 * @returns true if token was committed, false if no changes or invalid node
 */
export function commitFilterToken(options: CommitTokenOptions): boolean {
  const { tr, pos, fieldDef, validate } = options;

  const node = tr.doc.nodeAt(pos);
  if (!node || !isFilterToken(node)) return false;

  const value = node.attrs.value ?? '';
  const hasValue = !!value.trim();
  if (!hasValue) return false;

  // Run validation and determine invalid state
  let isInvalid = false;
  if (validate) {
    const result = validate(value);
    isInvalid = result !== true;
  }

  // Build current attrs
  const current: TokenEditableAttrs = {
    value: node.attrs.value ?? '',
    operator: node.attrs.operator ?? '',
    key: node.attrs.key ?? '',
    confirmed: node.attrs.confirmed ?? false,
    immutable: node.attrs.immutable ?? false,
    invalid: node.attrs.invalid ?? false,
    displayValue: node.attrs.displayValue ?? null,
    startContent: node.attrs.startContent ?? null,
    endContent: node.attrs.endContent ?? null,
  };

  // Compose actions: CONFIRM, then optionally MARK_IMMUTABLE
  const isImmutableField = fieldDef?.immutable ?? false;
  const shouldMarkImmutable = isImmutableField && !current.immutable;

  let next = tokenAttrReducer(current, { type: 'CONFIRM' });
  if (shouldMarkImmutable) {
    next = tokenAttrReducer(next, { type: 'MARK_IMMUTABLE' });
  }

  // Set invalid state directly in the patch
  next = { ...next, invalid: isInvalid };

  const patch = computeAttrsPatch(current, next);
  if (Object.keys(patch).length === 0) return true;

  // Apply patch via setNodeMarkup
  tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch });

  return true;
}
