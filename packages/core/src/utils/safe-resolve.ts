/**
 * Safe wrappers for ProseMirror document position resolution.
 *
 * doc.resolve() throws RangeError for invalid positions.
 * These utilities provide null-returning alternatives for cases where
 * position validity cannot be guaranteed.
 */
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';

/**
 * Safely resolve a position in a document.
 *
 * @param doc - The ProseMirror document
 * @param pos - The position to resolve
 * @returns ResolvedPos if valid, null if position is out of bounds
 */
export function safeResolve(doc: ProseMirrorNode, pos: number): ResolvedPos | null {
  try {
    return doc.resolve(pos);
  } catch {
    return null;
  }
}

/**
 * Adjacent nodes at a given position.
 */
export interface AdjacentNodes {
  nodeBefore: ProseMirrorNode | null;
  nodeAfter: ProseMirrorNode | null;
}

/**
 * Get adjacent nodes at a given position.
 *
 * @param doc - The ProseMirror document
 * @param pos - The position to check
 * @returns Adjacent nodes if position is valid, null otherwise
 */
export function getAdjacentNodes(doc: ProseMirrorNode, pos: number): AdjacentNodes | null {
  const $pos = safeResolve(doc, pos);
  if (!$pos) return null;

  return {
    nodeBefore: $pos.nodeBefore,
    nodeAfter: $pos.nodeAfter,
  };
}
