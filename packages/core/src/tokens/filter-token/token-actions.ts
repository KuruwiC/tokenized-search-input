import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { normalizeDateFieldValue } from '../../pickers/date-format';
import { recordInHistory } from '../../plugins/shared/meta';
import type { FieldDefinition } from '../../types';
import { resolveStoredValue } from '../../utils/enum-value';
import { findTokenById } from '../../utils/find-token';
import { isFilterToken, isFreeTextToken } from '../../utils/node-predicates';
import { type FieldResolutionSource, resolveField } from '../../utils/resolve-field';

/** The attributes of a filter token that the user enters. */
export interface FilterTokenEditableAttrs {
  key: string;
  operator: string;
  value: string;
  immutable: boolean;
}

/** The attributes of a free text token that the user enters. */
export interface FreeTextTokenEditableAttrs {
  value: string;
  quoted: boolean;
}

export type EditableTokenAttrs =
  | { kind: 'filter'; attrs: FilterTokenEditableAttrs }
  | { kind: 'freeText'; attrs: FreeTextTokenEditableAttrs };

export type FilterTokenAction =
  | { type: 'setKey'; key: string; operator: string }
  | { type: 'setOperator'; operator: string }
  | { type: 'setValue'; value: string }
  | { type: 'setImmutable'; immutable: boolean };

export interface FreeTextTokenAction {
  type: 'setValue';
  value: string;
  quoted: boolean;
}

export type TokenEditAction = FilterTokenAction | FreeTextTokenAction;

export function toEditableAttrs(node: ProseMirrorNode): EditableTokenAttrs | null {
  if (isFilterToken(node)) {
    return {
      kind: 'filter',
      attrs: {
        key: String(node.attrs.key ?? ''),
        operator: String(node.attrs.operator ?? ''),
        value: String(node.attrs.value ?? ''),
        immutable: node.attrs.immutable === true,
      },
    };
  }
  if (isFreeTextToken(node)) {
    return {
      kind: 'freeText',
      attrs: { value: String(node.attrs.value ?? ''), quoted: node.attrs.quoted === true },
    };
  }
  return null;
}

function nextFilterAttrs(
  current: FilterTokenEditableAttrs,
  action: TokenEditAction,
  field: FieldDefinition | null
): FilterTokenEditableAttrs | null {
  switch (action.type) {
    case 'setKey':
      return { ...current, key: action.key, operator: action.operator, immutable: false };
    case 'setOperator':
      return { ...current, operator: action.operator };
    case 'setValue':
      return { ...current, value: resolveStoredValue(field, action.value) };
    case 'setImmutable':
      return { ...current, immutable: action.immutable };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function nextFreeTextAttrs(
  current: FreeTextTokenEditableAttrs,
  action: TokenEditAction
): FreeTextTokenEditableAttrs | null {
  if (action.type !== 'setValue') return null;
  const quoted = 'quoted' in action ? action.quoted : current.quoted;
  return { value: action.value, quoted };
}

function isUnchanged(current: object, next: object): boolean {
  const currentRecord = current as Record<string, unknown>;
  return Object.entries(next).every(([key, value]) => currentRecord[key] === value);
}

/**
 * Applies a user edit to the token with the given id: the single writer of token
 * attributes. Every edit is a change to the query, so it is recorded in the undo
 * history. Display data is left alone: it names the key and value it describes.
 * `source` decides which field a token's key refers to, and so how a value is stored.
 *
 * @returns whether the token changed
 */
export function applyTokenAction(
  tr: Transaction,
  id: string,
  action: TokenEditAction,
  source: FieldResolutionSource
): boolean {
  const found = findTokenById(tr.doc, id);
  if (!found) return false;
  const editable = toEditableAttrs(found.node);
  if (!editable) return false;

  const next =
    editable.kind === 'filter'
      ? nextFilterAttrs(editable.attrs, action, resolveField(source, editable.attrs.key))
      : nextFreeTextAttrs(editable.attrs, action);
  if (!next || isUnchanged(editable.attrs, next)) return false;

  tr.setNodeMarkup(found.pos, undefined, { ...found.node.attrs, ...next });
  recordInHistory(tr);
  return true;
}

/** The stored form of a value typed for `field`: dates are kept in their canonical form. */
function storedForm(field: FieldDefinition | null, value: string): string {
  if (field?.type === 'date' || field?.type === 'datetime') {
    return normalizeDateFieldValue(value, field);
  }
  return value;
}

/**
 * Commits a filter token the user finished editing: a typed date is stored in its canonical
 * form, and a token of an immutable field that has a value becomes immutable.
 *
 * @returns whether the token changed
 */
export function commitFilterToken(
  tr: Transaction,
  id: string,
  source: FieldResolutionSource
): boolean {
  const found = findTokenById(tr.doc, id);
  if (!found || !isFilterToken(found.node)) return false;
  const field = resolveField(source, String(found.node.attrs.key ?? ''));
  const value = String(found.node.attrs.value ?? '');

  const stored = storedForm(field, value);
  let changed =
    stored !== value && applyTokenAction(tr, id, { type: 'setValue', value: stored }, source);
  if (field?.immutable && stored.trim()) {
    changed =
      applyTokenAction(tr, id, { type: 'setImmutable', immutable: true }, source) || changed;
  }
  return changed;
}
