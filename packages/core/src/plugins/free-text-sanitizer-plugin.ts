import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { FreeTextMode } from '../types';
import { isFilterToken, isFreeTextToken } from '../utils/node-predicates';
import { isTextSanitized, markTextSanitized } from './shared/meta';

const freeTextSanitizerKey = new PluginKey('freeTextSanitizer');

interface FreeTextSanitizerContext {
  freeTextMode: FreeTextMode;
}

function countTokens(doc: ProseMirrorNode): number {
  let count = 0;
  doc.descendants((node) => {
    if (isFilterToken(node) || isFreeTextToken(node)) count++;
    return true;
  });
  return count;
}

function hasTokenInsertion(oldState: EditorState, newState: EditorState): boolean {
  const oldCount = countTokens(oldState.doc);
  const newCount = countTokens(newState.doc);
  return newCount > oldCount;
}

/** Text nodes that are direct children of the paragraph, so text inside tokens is excluded. */
function collectFreeTextNodes(doc: ProseMirrorNode): Array<{ from: number; to: number }> {
  const textNodes: Array<{ from: number; to: number }> = [];

  doc.descendants((node, pos, parent) => {
    if (node.isText && parent?.type.name === 'paragraph') {
      textNodes.push({ from: pos, to: pos + node.nodeSize });
    }
    return true;
  });

  return textNodes;
}

/**
 * Removes the free text left in the document when freeTextMode is 'none', once a
 * transaction has inserted tokens (the auto-tokenize plugin has already read the text).
 * The `finalizeInput` command removes what remains on submit or blur, where no token is
 * inserted.
 */
export function createFreeTextSanitizerPlugin(getContext: () => FreeTextSanitizerContext) {
  return new Plugin({
    key: freeTextSanitizerKey,

    appendTransaction(transactions, oldState, newState) {
      if (transactions.some(isTextSanitized)) {
        return null;
      }

      const context = getContext();
      if (context.freeTextMode !== 'none') {
        return null;
      }

      if (!transactions.some((tr) => tr.docChanged)) {
        return null;
      }

      if (!hasTokenInsertion(oldState, newState)) {
        return null;
      }

      const textNodes = collectFreeTextNodes(newState.doc);
      if (textNodes.length === 0) {
        return null;
      }

      const tr = newState.tr;
      for (let i = textNodes.length - 1; i >= 0; i--) {
        tr.delete(textNodes[i].from, textNodes[i].to);
      }

      if (!tr.docChanged) {
        return null;
      }

      return markTextSanitized(tr);
    },
  });
}
