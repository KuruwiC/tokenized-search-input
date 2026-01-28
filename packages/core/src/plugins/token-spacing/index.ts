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

// Re-export for external use
export type { InsideTokenInfo, SelectionAction } from './selection-invariant';
export { enforceSelectionInvariant, getCursorInsideToken } from './selection-invariant';
export { findSpacerAfter, findSpacerBefore } from './spacer-helpers';
export type { DocumentRepairPhase, RepairContext } from './types';

/**
 * Extension that maintains spacer invariant and handles token cleanup.
 *
 * INVARIANT: Every token must have a spacer on both sides.
 * Document structure: [spacer][token1][spacer][spacer][token2][spacer]
 *
 * Responsibilities:
 * 1. Delete empty tokens when focus moves away (with adjacent spacers)
 * 2. Remove orphaned spacers (spacers with no adjacent tokens)
 * 3. Insert missing spacers (when range deletion removes them)
 *
 * Note: Selection Invariant enforcement is handled by SelectionInvariantExtension.
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
