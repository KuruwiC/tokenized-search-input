import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { tokenFocusKey } from '../token-focus-plugin';
import { runDocumentRepairPipeline } from './repair-pipeline';
import type { RepairContext } from './types';

export const tokenSpacingKey = new PluginKey('tokenSpacing');

// Type guard for ProseMirror history plugin metadata
// History plugin sets { redo: boolean } on undo/redo transactions
function isHistoryMeta(meta: unknown): meta is { redo: boolean } {
  return meta !== null && typeof meta === 'object' && 'redo' in meta;
}

export type { DocumentRepairPhase, RepairContext } from './types';

/**
 * Extension that keeps the document consistent after edits.
 *
 * Responsibilities:
 * 1. Focus an empty token that undo or redo restored
 * 2. Delete empty tokens when focus moves away
 * 3. Keep the words on either side of a removed token apart
 */
export const TokenSpacingExtension = Extension.create({
  name: 'tokenSpacing',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: tokenSpacingKey,

        appendTransaction(transactions, oldState, newState) {
          if (transactions.some((tr) => tr.getMeta(tokenSpacingKey))) return null;

          // Skip during IME composition to avoid disrupting input
          if (transactions.some((tr) => tr.getMeta('composition'))) return null;

          const oldFocusState = tokenFocusKey.getState(oldState);
          const newFocusState = tokenFocusKey.getState(newState);
          const oldFocusedPos = oldFocusState?.focusedPos ?? null;
          const newFocusedPos = newFocusState?.focusedPos ?? null;

          const docChanged = transactions.some((tr) => tr.docChanged);
          const focusChanged = oldFocusedPos !== newFocusedPos;

          // Detect history operation (undo/redo)
          const isHistoryOperation = transactions.some((tr) =>
            isHistoryMeta(tr.getMeta('history$'))
          );

          if (!docChanged && !focusChanged) return null;

          const tr = newState.tr;

          const context: RepairContext = {
            doc: newState.doc,
            schema: newState.schema,
            oldFocusedPos,
            newFocusedPos,
            docChanged,
            focusChanged,
            isHistoryOperation,
            transactions,
          };

          const docModified = runDocumentRepairPipeline(tr, context);

          if (!docModified) return null;

          tr.setMeta(tokenSpacingKey, { enforced: true });
          tr.setMeta('addToHistory', false);

          return tr;
        },
      }),
    ];
  },
});
