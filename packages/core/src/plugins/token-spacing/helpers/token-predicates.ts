import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { isFilterToken, isFreeTextToken, isToken } from '../../../utils/node-predicates';

/**
 * Check if a token is empty (has no meaningful value).
 */
export function isEmptyToken(node: ProseMirrorNode): boolean {
  if (isFilterToken(node)) {
    const value = node.attrs.value;
    return !value || !String(value).trim();
  }
  if (isFreeTextToken(node)) {
    return !node.attrs.value || !String(node.attrs.value).trim();
  }
  return false;
}

/**
 * Check if an empty token exists at a given position.
 * @returns The position if an empty token exists, null otherwise
 */
export function getEmptyTokenAt(doc: ProseMirrorNode, pos: number | null): number | null {
  if (pos === null) return null;

  const node = doc.nodeAt(pos);
  if (!node) return null;

  if (isToken(node) && isEmptyToken(node)) {
    return pos;
  }

  return null;
}
