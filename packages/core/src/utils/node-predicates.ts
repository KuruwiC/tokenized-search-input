import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export const NODE_TYPE_NAMES = {
  doc: 'doc',
  paragraph: 'paragraph',
  text: 'text',
  filterToken: 'filterToken',
  freeTextToken: 'freeTextToken',
  spacer: 'spacer',
} as const;

export const TOKEN_TYPES = [NODE_TYPE_NAMES.filterToken, NODE_TYPE_NAMES.freeTextToken] as const;
export type TokenTypeName = (typeof TOKEN_TYPES)[number];

export function isToken(node: ProseMirrorNode): boolean {
  return TOKEN_TYPES.includes(node.type.name as TokenTypeName);
}

export function isFilterToken(node: ProseMirrorNode): boolean {
  return node.type.name === NODE_TYPE_NAMES.filterToken;
}

export function isFreeTextToken(node: ProseMirrorNode): boolean {
  return node.type.name === NODE_TYPE_NAMES.freeTextToken;
}

export function isSpacer(node: ProseMirrorNode): boolean {
  return node.type.name === NODE_TYPE_NAMES.spacer;
}

export function isText(node: ProseMirrorNode): boolean {
  return node.type.name === NODE_TYPE_NAMES.text;
}

// Includes plain text and any future inline widgets
export function isGenericInlineContent(node: ProseMirrorNode): boolean {
  return !isToken(node) && !isSpacer(node) && node.isInline;
}
