import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
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

/**
 * Deletes the free text of the document in `tr`: every text node of the paragraph. Text
 * cannot sit inside a token, so the tokens are all that remains. Every removal of free
 * text, in none mode or when changing to it, goes through here.
 */
export function removeFreeText(tr: Transaction): Transaction {
  const textNodes: Array<{ from: number; to: number }> = [];
  tr.doc.descendants((node, pos) => {
    if (node.isText) textNodes.push({ from: pos, to: pos + node.nodeSize });
  });
  for (let i = textNodes.length - 1; i >= 0; i--) {
    tr.delete(textNodes[i].from, textNodes[i].to);
  }
  return tr;
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

      const tr = removeFreeText(newState.tr);
      return tr.docChanged ? markTextSanitized(tr) : null;
    },
  });
}
