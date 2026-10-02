import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { isToken } from './node-predicates';

export interface FoundToken {
  node: ProseMirrorNode;
  pos: number;
}

/** Finds the token with the given id. Token ids are unique within a document. */
export function findTokenById(doc: ProseMirrorNode, id: string): FoundToken | null {
  let found: FoundToken | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (isToken(node)) {
      if (node.attrs.id === id) found = { node, pos };
      return false;
    }
    return true;
  });
  return found;
}
