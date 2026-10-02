import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Decoration } from '@tiptap/pm/view';

/**
 * Class of the element a token node view puts in the paragraph. The space around a token
 * is its margin, so a pointer in that space hits the paragraph rather than the token.
 */
export const TOKEN_NODE_CLASS = 'tsi-token-node';

interface NodeViewUpdate {
  oldNode: ProseMirrorNode;
  oldDecorations: readonly Decoration[];
  newNode: ProseMirrorNode;
  newDecorations: readonly Decoration[];
  updateProps: () => void;
}

function sameSpec(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/**
 * Token decorations carry what the view renders in their spec, so comparing specs
 * suffices. Positions are ignored: they shift with every edit before the token.
 */
function sameDecorations(a: readonly Decoration[], b: readonly Decoration[]): boolean {
  return a.length === b.length && a.every((decoration, i) => sameSpec(decoration.spec, b[i].spec));
}

/**
 * Node view update for token views. The default React node view re-renders only
 * when the node changes; token views also render the validation that arrives as
 * a node decoration, so a decoration change re-renders them as well.
 */
export function updateTokenNodeView({
  oldNode,
  oldDecorations,
  newNode,
  newDecorations,
  updateProps,
}: NodeViewUpdate): boolean {
  if (newNode.type !== oldNode.type) return false;
  if (newNode !== oldNode || !sameDecorations(oldDecorations, newDecorations)) updateProps();
  return true;
}
