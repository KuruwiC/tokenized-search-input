/**
 * Free Text Sanitizer Plugin
 *
 * Removes free text when freeTextMode is 'none'.
 * This plugin runs AFTER auto-tokenize-plugin, which handles tokenization.
 * Any remaining text nodes after tokenization are removed.
 */
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { isFilterToken, isFreeTextToken } from '../utils/node-predicates';

const freeTextSanitizerKey = new PluginKey('freeTextSanitizer');

export interface FreeTextSanitizerContext {
  freeTextMode: string;
}

/**
 * Count token nodes in a document.
 */
function countTokens(doc: ProseMirrorNode): number {
  let count = 0;
  doc.descendants((node) => {
    if (isFilterToken(node) || isFreeTextToken(node)) count++;
    return true;
  });
  return count;
}

/**
 * Check if token count increased between old and new state.
 */
function hasTokenInsertion(oldState: EditorState, newState: EditorState): boolean {
  const oldCount = countTokens(oldState.doc);
  const newCount = countTokens(newState.doc);
  return newCount > oldCount;
}

/**
 * Collect text nodes that are direct children of the paragraph (top-level free text).
 * Excludes text inside token NodeViews.
 */
function collectFreeTextNodes(doc: ProseMirrorNode): Array<{ from: number; to: number }> {
  const textNodes: Array<{ from: number; to: number }> = [];

  doc.descendants((node, pos, parent) => {
    // Only collect text nodes that are direct children of paragraph (not inside tokens)
    if (node.isText && parent?.type.name === 'paragraph') {
      textNodes.push({ from: pos, to: pos + node.nodeSize });
    }
    return true;
  });

  return textNodes;
}

/**
 * Plugin that removes free text when freeTextMode is 'none'.
 * Triggers when tokens are inserted (after auto-tokenize-plugin runs).
 *
 * This plugin provides "early cleanup" - removing free text immediately when
 * tokens are created. The `finalizeInput` command provides "final cleanup"
 * for cases like submit/blur where no token insertion occurs.
 */
export function createFreeTextSanitizerPlugin(getContext: () => FreeTextSanitizerContext) {
  return new Plugin({
    key: freeTextSanitizerKey,

    appendTransaction(transactions, oldState, newState) {
      if (transactions.some((tr) => tr.getMeta(freeTextSanitizerKey))) {
        return null;
      }

      const context = getContext();
      if (context.freeTextMode !== 'none') {
        return null;
      }

      if (!transactions.some((tr) => tr.docChanged)) {
        return null;
      }

      // Only trigger when tokens are inserted (auto-tokenize-plugin already ran)
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

      return tr.setMeta(freeTextSanitizerKey, true);
    },
  });
}
