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
