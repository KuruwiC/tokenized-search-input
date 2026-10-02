import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Selection } from '@tiptap/pm/state';

/**
 * The caret may sit at any inline position that is not inside an atom: between two
 * tokens, next to a token, or anywhere in text. `pos` is returned when it is such a
 * position; otherwise the nearest one in `direction`, or in the other direction when
 * there is none that way.
 */
export function nearestValidCaret(doc: ProseMirrorNode, pos: number, direction: -1 | 1): number {
  let $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  for (let depth = 1; depth <= $pos.depth; depth++) {
    if ($pos.node(depth).isAtom) {
      $pos = doc.resolve(direction > 0 ? $pos.after(depth) : $pos.before(depth));
      break;
    }
  }
  if ($pos.parent.inlineContent) return $pos.pos;
  const found =
    Selection.findFrom($pos, direction, true) ?? Selection.findFrom($pos, -direction, true);
  return found ? found.head : $pos.pos;
}
