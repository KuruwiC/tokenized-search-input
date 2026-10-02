import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { findTokenById } from '../../utils/find-token';

/** A token without a meaningful value. */
export function isEmptyToken(node: ProseMirrorNode): boolean {
  return !String(node.attrs.value ?? '').trim();
}

/** Removes the token with id `tokenId` when the user left it empty. */
export function removeEmptyToken(tr: Transaction, tokenId: string): boolean {
  const found = findTokenById(tr.doc, tokenId);
  if (!found || !isEmptyToken(found.node)) return false;
  tr.delete(found.pos, found.pos + found.node.nodeSize);
  return true;
}
