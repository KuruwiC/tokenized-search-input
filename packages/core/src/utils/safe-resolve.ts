/**
 * Safe wrappers for ProseMirror document position resolution.
 *
 * doc.resolve() throws RangeError for invalid positions.
 * These utilities provide null-returning alternatives for cases where
 * position validity cannot be guaranteed.
 */
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';

/** Resolves `pos` in `doc`, or returns null when it is out of bounds. */
export function safeResolve(doc: ProseMirrorNode, pos: number): ResolvedPos | null {
  try {
    return doc.resolve(pos);
  } catch {
    return null;
  }
}
