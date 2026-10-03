import type { Transaction } from '@tiptap/pm/state';
import { findTokenById } from '../../utils/find-token';
import { isEmptyToken } from '../../utils/node-predicates';

export function removeEmptyToken(tr: Transaction, tokenId: string): boolean {
  const found = findTokenById(tr.doc, tokenId);
  if (!found || !isEmptyToken(found.node)) return false;
  tr.delete(found.pos, found.pos + found.node.nodeSize);
  return true;
}
