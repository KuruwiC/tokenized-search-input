import { Extension } from '@tiptap/core';
import { type EditorState, Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { isToken } from '../../utils/node-predicates';
import { tokenFocusKey } from '../token-focus-plugin';
import { removeEmptyToken } from './empty-token-cleanup';
import { focusRestoredEmptyToken } from './history-empty-token-focus';
import { keepWordsApart } from './word-boundary';

export const documentRepairKey = new PluginKey('documentRepair');

function isHistoryTransaction(tr: Transaction): boolean {
  const meta: unknown = tr.getMeta('history$');
  return meta !== null && typeof meta === 'object' && 'redo' in meta;
}

/** A document change that undo reverts. */
function isRecorded(tr: Transaction): boolean {
  return tr.docChanged && tr.getMeta('addToHistory') !== false;
}

function focusedTokenId(state: EditorState): string | null {
  const pos = tokenFocusKey.getState(state)?.focusedPos ?? null;
  if (pos === null || pos >= state.doc.content.size) return null;
  const node = state.doc.nodeAt(pos);
  return node && isToken(node) ? String(node.attrs.id) : null;
}

/**
 * Repairs the document after the edits that made it inconsistent with the rules for
 * tokens:
 * 1. An empty token is removed when the user leaves it
 * 2. Words a removed token separated are kept apart by a space
 * 3. An empty token that undo or redo restored is focused
 *
 * A repair belongs to the undo step of the edits it follows, so undo reverts both
 * together; after undo or redo, the history keeps it on the other stack. A repair that
 * follows no recorded edit, such as removing a token the user left empty, is not
 * recorded: the document returns to how it was before the token was entered.
 */
export const DocumentRepairExtension = Extension.create({
  name: 'documentRepair',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: documentRepairKey,

        appendTransaction(transactions, oldState, newState) {
          const skip = transactions.some(
            (tr) => tr.getMeta(documentRepairKey) || tr.getMeta('composition')
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
            if (focusRestoredEmptyToken(tr)) repaired = true;
          }
          if (!repaired) return null;

          if (!transactions.some(isRecorded)) tr.setMeta('addToHistory', false);
          return tr.setMeta(documentRepairKey, true);
        },
      }),
    ];
  },
});
