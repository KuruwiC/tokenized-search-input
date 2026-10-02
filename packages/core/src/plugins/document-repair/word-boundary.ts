import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import { isToken } from '../../utils/node-predicates';
import { isHistoryTransaction } from '../shared/meta';

function containsToken(doc: ProseMirrorNode, from: number, to: number): boolean {
  let found = false;
  doc.nodesBetween(from, to, (node) => {
    if (isToken(node)) found = true;
    return !found;
  });
  return found;
}

/**
 * Where, in the document `transactions` end with, an edit removed or replaced content
 * that held a token: both ends of each such replacement. Undo and redo are not edits:
 * the document they restore already kept its words apart.
 */
export function findTokenRemovalEdges(transactions: readonly Transaction[]): number[] {
  const steps = transactions.flatMap((tr) =>
    tr.steps.map((step, index) => ({
      map: step.getMap(),
      docBefore: tr.docs[index],
      restores: isHistoryTransaction(tr),
    }))
  );
  const mapping = new Mapping(steps.map(({ map }) => map));
  const edges: number[] = [];
  steps.forEach(({ map, docBefore, restores }, index) => {
    if (!docBefore || restores) return;
    const later = mapping.slice(index + 1);
    map.forEach((oldStart, oldEnd, newStart, newEnd) => {
      if (!containsToken(docBefore, oldStart, oldEnd)) return;
      edges.push(later.map(newStart, -1), later.map(newEnd, 1));
    });
  });
  return edges;
}

function joinsTwoWords(doc: ProseMirrorNode, pos: number): boolean {
  if (pos <= 0 || pos >= doc.content.size) return false;
  const $pos = doc.resolve(pos);
  if (!$pos.nodeBefore?.isText || !$pos.nodeAfter?.isText) return false;
  return /^\S\S$/.test(doc.textBetween(pos - 1, pos + 1));
}

/**
 * A token separates the words on either side of it. When tokens are removed or
 * replaced, whatever the path (a range deletion, the delete button, validation, cut,
 * typing over a selection), text that comes to touch text where they were is kept
 * apart by a space.
 */
export function keepWordsApart(tr: Transaction, transactions: readonly Transaction[]): boolean {
  const edges = [...new Set(findTokenRemovalEdges([...transactions, tr]))].sort((a, b) => b - a);
  let modified = false;
  for (const pos of edges) {
    if (!joinsTwoWords(tr.doc, pos)) continue;
    tr.insertText(' ', pos);
    modified = true;
  }
  return modified;
}
