// Enforces single-paragraph invariant (handles TipTap #2560 bug)
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';

export const docInvariantKey = new PluginKey('docInvariant');

const hasDocChanged = (transactions: readonly Transaction[]): boolean =>
  transactions.some((tr) => tr.docChanged);

const requiresMerge = (doc: ProseMirrorNode): boolean => doc.childCount > 1;

function collectAllContent(doc: ProseMirrorNode): ProseMirrorNode[] {
  const content: ProseMirrorNode[] = [];

  doc.forEach((node) => {
    if (node.type.name === 'paragraph') {
      node.content.forEach((child) => {
        content.push(child);
      });
    }
  });

  return content;
}

function createMergedParagraph(doc: ProseMirrorNode): ProseMirrorNode | null {
  const firstParagraph = doc.firstChild;
  if (!firstParagraph || firstParagraph.type.name !== 'paragraph') {
    return null;
  }

  const allContent = collectAllContent(doc);
  const fragment = Fragment.from(allContent);

  return firstParagraph.type.create(firstParagraph.attrs, fragment);
}

export function createDocInvariantPlugin(): Plugin {
  return new Plugin({
    key: docInvariantKey,

    appendTransaction(transactions, _oldState, newState) {
      if (!hasDocChanged(transactions)) {
        return null;
      }

      const { doc } = newState;

      if (!requiresMerge(doc)) {
        return null;
      }

      // Merge all paragraphs into one
      const mergedParagraph = createMergedParagraph(doc);
      if (!mergedParagraph) {
        return null;
      }

      const tr = newState.tr;
      tr.replaceWith(0, doc.content.size, mergedParagraph);
      tr.setMeta(docInvariantKey, true);
      tr.setMeta('addToHistory', false);

      return tr;
    },
  });
}
