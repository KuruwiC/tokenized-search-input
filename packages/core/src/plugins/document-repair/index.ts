import { Extension } from '@tiptap/core';
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state';
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
import { removeEmptyToken } from './empty-token-cleanup';
import { focusRestoredEmptyToken } from './history-empty-token-focus';
import { keepWordsApart } from './word-boundary';

const documentRepairKey = new PluginKey('documentRepair');

function focusedTokenId(state: EditorState): string | null {
  return getFocusedToken(state)?.id ?? null;
}

/**
 * Repairs the document after the edits that made it inconsistent with the rules for
 * tokens:
 * 1. An empty token is removed when the user leaves it
 * 2. Words that an edit removed a token from between are kept apart by a space
 * 3. An empty token that undo or redo restored is focused
 *
 * Undo and redo restore a document that already existed, so the space between words
 * is not put in after them; leaving a token and focusing a restored one follow the
 * user's focus, not the document, and still apply.
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
          const docChanged = transactions.some((tr) => tr.docChanged);
          const focusLeft = left !== null && left !== focusedTokenId(newState);
          if (!docChanged && !focusLeft) return null;

          const tr = newState.tr;
          let repaired = focusLeft && removeEmptyToken(tr, left);
          if (keepWordsApart(tr, transactions)) repaired = true;
          if (docChanged && transactions.some(isHistoryTransaction)) {
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
