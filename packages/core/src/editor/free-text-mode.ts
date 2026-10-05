import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import type { EditorContextStorage } from '../extensions/editor-context';
import { getFreeTextStrategy } from '../plugins/auto-tokenize/free-text-strategy';
import { tokenizeRange } from '../plugins/auto-tokenize/tokenize-range';
import { removeFreeText } from '../plugins/free-text-sanitizer-plugin';
import type { FocusTransitionContext } from '../plugins/token-focus';
import { isFreeTextToken } from '../utils/node-predicates';

/** The top-level inline nodes of the document, last first, so earlier positions stay valid. */
function inlineNodesFromEnd(doc: ProseMirrorNode): { node: ProseMirrorNode; pos: number }[] {
  const nodes: { node: ProseMirrorNode; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    nodes.push({ node, pos });
    return false;
  });
  return nodes.reverse();
}

/**
 * Reads the content again under the free text mode of `context`. Outside tokenize mode
 * free text tokens turn back into the text they were typed as; the text is then
 * tokenized as typed text is, and in none mode the text left over is removed. Filter
 * tokens are not touched, so they keep their ids and the meta held for them.
 */
export function applyFreeTextMode(
  tr: Transaction,
  context: EditorContextStorage,
  focus?: FocusTransitionContext
): void {
  const { schema } = tr.doc.type;
  if (context.freeTextMode !== 'tokenize') {
    const plain = getFreeTextStrategy('plain');
    for (const { node, pos } of inlineNodesFromEnd(tr.doc)) {
      if (!isFreeTextToken(node)) continue;
      const { value, quoted } = node.attrs;
      let text = plain.toDocContent({ type: 'freeText', value, quoted })?.text ?? '';
      // Text next to text is one run, so a word boundary has to stay a space.
      const before = tr.doc.resolve(pos).nodeBefore;
      const after = tr.doc.resolve(pos + node.nodeSize).nodeAfter;
      if (text && before?.isText && !/\s$/.test(before.text ?? '')) text = ` ${text}`;
      if (text && after?.isText && !/^\s/.test(after.text ?? '')) text = `${text} `;
      if (text) tr.replaceWith(pos, pos + node.nodeSize, schema.text(text));
      else tr.delete(pos, pos + node.nodeSize);
    }
  }
  tokenizeRange(tr, 0, tr.doc.content.size, context, focus);
  if (context.freeTextMode === 'none') removeFreeText(tr);
}
