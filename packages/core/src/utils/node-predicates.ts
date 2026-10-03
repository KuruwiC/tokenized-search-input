import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export const NODE_TYPE_NAMES = {
  doc: 'doc',
  paragraph: 'paragraph',
  text: 'text',
  filterToken: 'filterToken',
  freeTextToken: 'freeTextToken',
} as const;

const TOKEN_TYPES = [NODE_TYPE_NAMES.filterToken, NODE_TYPE_NAMES.freeTextToken] as const;
type TokenTypeName = (typeof TOKEN_TYPES)[number];

export function isToken(node: ProseMirrorNode): boolean {
  return TOKEN_TYPES.includes(node.type.name as TokenTypeName);
}

export function isFilterToken(node: ProseMirrorNode): boolean {
  return node.type.name === NODE_TYPE_NAMES.filterToken;
}

export function isFreeTextToken(node: ProseMirrorNode): boolean {
  return node.type.name === NODE_TYPE_NAMES.freeTextToken;
}

/** Whether a token's value is empty or only whitespace, so it says nothing to search for. */
export function isEmptyToken(node: ProseMirrorNode): boolean {
  return !String(node.attrs.value ?? '').trim();
}
