import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { isEmptyToken, isToken } from '../../utils/node-predicates';

/** What the transactions being repaired did, as far as empty tokens are concerned. */
export interface EmptyTokenScope {
  /** The document before the transactions. */
  before: ProseMirrorNode;
  /** The token focused after them. */
  focusedId: string | null;
  /** The token the focus left in them. */
  leftId: string | null;
  /** Whether they are undo or redo. */
  restoring: boolean;
}

function tokenIds(doc: ProseMirrorNode): Set<string> {
  const ids = new Set<string>();
  doc.descendants((node) => {
    if (isToken(node)) ids.add(String(node.attrs.id));
    return !isToken(node);
  });
  return ids;
}

/**
 * A token without a value is one the user is filling in: it stays while they are in it
 * and goes once they are not. Removes, in `tr`, every empty token that is not focused,
 * except one the transactions added, which is still being created. Undo and redo restore
 * a document that existed, so after them only the token the focus left is removed.
 *
 * @returns whether a token was removed
 */
export function removeEmptyTokens(tr: Transaction, scope: EmptyTokenScope): boolean {
  const existed = tokenIds(scope.before);
  const ranges: { from: number; to: number }[] = [];
  tr.doc.descendants((node, pos) => {
    if (!isToken(node)) return true;
    const id = String(node.attrs.id);
    const removable =
      isEmptyToken(node) &&
      id !== scope.focusedId &&
      existed.has(id) &&
      (!scope.restoring || id === scope.leftId);
    if (removable) ranges.push({ from: pos, to: pos + node.nodeSize });
    return false;
  });
  for (const { from, to } of ranges.reverse()) tr.delete(from, to);
  return ranges.length > 0;
}
