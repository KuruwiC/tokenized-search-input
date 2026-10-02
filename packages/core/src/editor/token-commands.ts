import type { Editor, JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  computeAttrsPatch,
  type TokenEditableAttrs,
  tokenAttrReducer,
} from '../tokens/filter-token/token-attr-reducer';
import { isFilterToken, isToken, NODE_TYPE_NAMES } from '../utils/node-predicates';
import { updateTokenAttrs } from '../utils/token-attrs';
import type { TokenDisplay, TokenPatch } from './tokenized-search-input.types';

type TokenAttrs = Record<string, unknown>;

function toEditableAttrs(attrs: TokenAttrs): TokenEditableAttrs {
  return {
    value: (attrs.value as string | undefined) ?? '',
    operator: (attrs.operator as string | undefined) ?? '',
    key: (attrs.key as string | undefined) ?? '',
    confirmed: (attrs.confirmed as boolean | undefined) ?? false,
    immutable: (attrs.immutable as boolean | undefined) ?? false,
    invalid: (attrs.invalid as boolean | undefined) ?? false,
    displayValue: (attrs.displayValue as string | null | undefined) ?? null,
    startContent: (attrs.startContent as TokenEditableAttrs['startContent']) ?? null,
    endContent: (attrs.endContent as TokenEditableAttrs['endContent']) ?? null,
  };
}

/**
 * Attribute changes that `updateToken` applies to a token: the patched fields
 * run through the token attribute reducer, and a token that ends up with a value
 * counts as committed.
 */
export function computeTokenPatchAttrs(attrs: TokenAttrs, patch: TokenPatch): TokenAttrs {
  const current = toEditableAttrs(attrs);
  let next = current;
  if (patch.operator !== undefined && patch.operator !== next.operator) {
    next = tokenAttrReducer(next, { type: 'OPERATOR_CHANGED', operator: patch.operator });
  }
  if (patch.value !== undefined && patch.value !== next.value) {
    next = tokenAttrReducer(next, { type: 'VALUE_CHANGED', value: patch.value });
  }
  if (next.value.trim()) {
    next = tokenAttrReducer(next, { type: 'CONFIRM' });
  }
  return computeAttrsPatch(current, next);
}

/** Display attributes that `setTokenDisplay` applies; omitted members are left untouched. */
export function computeTokenDisplayAttrs(display: TokenDisplay): TokenAttrs {
  const attrs: TokenAttrs = {};
  if (display.displayValue !== undefined) attrs.displayValue = display.displayValue;
  if (display.startContent !== undefined) attrs.startContent = display.startContent;
  if (display.endContent !== undefined) attrs.endContent = display.endContent;
  return attrs;
}

function findToken(
  editor: Editor,
  id: string,
  matches: (node: ProseMirrorNode) => boolean
): { pos: number; node: ProseMirrorNode } | null {
  let found: { pos: number; node: ProseMirrorNode } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (matches(node) && node.attrs.id === id) {
      found = { pos, node };
      return false;
    }
    return true;
  });
  return found;
}

function patchFilterToken(editor: Editor, id: string, attrsFor: (attrs: TokenAttrs) => TokenAttrs) {
  const found = findToken(editor, id, isFilterToken);
  if (!found) return;
  const attrs = attrsFor(found.node.attrs);
  if (Object.keys(attrs).length === 0) return;
  editor.view.dispatch(updateTokenAttrs(editor.state.tr, found.pos, attrs));
}

export function updateTokenInEditor(editor: Editor, id: string, patch: TokenPatch): void {
  patchFilterToken(editor, id, (attrs) => computeTokenPatchAttrs(attrs, patch));
}

export function setTokenDisplayInEditor(editor: Editor, id: string, display: TokenDisplay): void {
  const attrs = computeTokenDisplayAttrs(display);
  patchFilterToken(editor, id, () => attrs);
}

export function deleteTokenInEditor(editor: Editor, id: string): void {
  const found = findToken(editor, id, isToken);
  if (!found) return;
  const { tr } = editor.state;
  editor.view.dispatch(tr.delete(found.pos, found.pos + found.node.nodeSize));
}

function mapDoc(
  node: JSONContent,
  visit: (node: JSONContent) => JSONContent | null
): JSONContent | null {
  const visited = visit(node);
  if (!visited || !visited.content) return visited;
  const content = visited.content
    .map((child) => mapDoc(child, visit))
    .filter((child): child is JSONContent => child !== null);
  return { ...visited, content };
}

function mapFilterToken(
  doc: JSONContent,
  id: string,
  attrsFor: (attrs: TokenAttrs) => TokenAttrs
): JSONContent {
  return (
    mapDoc(doc, (node) => {
      if (node.type !== NODE_TYPE_NAMES.filterToken || node.attrs?.id !== id) return node;
      return { ...node, attrs: { ...node.attrs, ...attrsFor(node.attrs ?? {}) } };
    }) ?? doc
  );
}

/** Document-level counterparts of the editor commands, for a document held while no live editor exists. */
export function updateTokenInDoc(doc: JSONContent, id: string, patch: TokenPatch): JSONContent {
  return mapFilterToken(doc, id, (attrs) => computeTokenPatchAttrs(attrs, patch));
}

export function setTokenDisplayInDoc(
  doc: JSONContent,
  id: string,
  display: TokenDisplay
): JSONContent {
  const attrs = computeTokenDisplayAttrs(display);
  return mapFilterToken(doc, id, () => attrs);
}

export function deleteTokenInDoc(doc: JSONContent, id: string): JSONContent {
  return (
    mapDoc(doc, (node) =>
      (node.type === NODE_TYPE_NAMES.filterToken || node.type === NODE_TYPE_NAMES.freeTextToken) &&
      node.attrs?.id === id
        ? null
        : node
    ) ?? doc
  );
}
