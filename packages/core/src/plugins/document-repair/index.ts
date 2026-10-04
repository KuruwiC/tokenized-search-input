import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { getFocusContext } from '../../extensions/editor-context';
import {
  isCompositionTransaction,
  isDocumentRepaired,
  isHistoryTransaction,
  isRecordedInHistory,
  markDocumentRepaired,
  withoutHistory,
} from '../shared/meta';
import { getFocusedToken } from '../token-focus';
import { removeEmptyTokens } from './empty-token-cleanup';
import { focusRestoredEmptyToken } from './history-empty-token-focus';
import { keepWordsApart } from './word-boundary';

const documentRepairKey = new PluginKey('documentRepair');

function focusedTokenId(state: EditorState): string | null {
  return getFocusedToken(state)?.id ?? null;
}

/**
 * The document at the start of the dispatch `transactions` belong to. A transaction that
 * a plugin appended names the dispatched one it follows.
 */
function dispatchStartDoc(transactions: readonly Transaction[]): ProseMirrorNode | undefined {
  const [first] = transactions;
  if (!first) return undefined;
  const root = (first.getMeta('appendedTransaction') as Transaction | undefined) ?? first;
  return root.before;
}

/**
 * Repairs the document after the edits that made it inconsistent with the rules for
 * tokens. It is the one place that repairs the shape of tokens, whatever validation is
 * configured:
 * 1. An empty token is removed once the user is not in it
 * 2. Words that an edit removed a token from between are kept apart by a space
 * 3. An empty token that undo or redo restored is focused
 *
 * Undo and redo restore a document that already existed, so no empty token other than
 * the one the user left is removed after them and the space between words is not put
 * in; leaving a token and focusing a restored one follow the user's focus, not the
 * document, and still apply.
 *
 * A repair belongs to the undo step of the edits it follows, so undo reverts both
 * together; after undo or redo, the history keeps it on the other stack. A repair that
 * follows no recorded edit, such as removing a token the user left empty, is not
 * recorded: the document returns to how it was before the token was entered.
 */
export const DocumentRepairExtension = Extension.create({
  name: 'documentRepair',

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: documentRepairKey,

        appendTransaction(transactions, oldState, newState) {
          const skip = transactions.some(
            (tr) => isDocumentRepaired(tr) || isCompositionTransaction(tr)
          );
          if (skip) return null;

          const left = focusedTokenId(oldState);
          const focused = focusedTokenId(newState);
          const docChanged = transactions.some((tr) => tr.docChanged);
          const focusLeft = left !== null && left !== focused;
          if (!docChanged && !focusLeft) return null;

          const restoring = transactions.some(isHistoryTransaction);
          const tr = newState.tr;
          let repaired = removeEmptyTokens(tr, {
            // A token is added when the dispatch adds it, whichever round repairs it.
            before: dispatchStartDoc(transactions) ?? oldState.doc,
            focusedId: focused,
            leftId: focusLeft ? left : null,
            restoring,
          });
          if (keepWordsApart(tr, transactions)) repaired = true;
          if (docChanged && restoring) {
            if (focusRestoredEmptyToken(tr, getFocusContext(editor, newState))) repaired = true;
          }
          if (!repaired) return null;

          if (!transactions.some(isRecordedInHistory)) withoutHistory(tr);
          return markDocumentRepaired(tr);
        },
      }),
    ];
  },
});
