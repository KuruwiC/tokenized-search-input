// Kept apart from the plugin so the modules it imports can read its state without a circular import.

import { PluginKey, type Transaction } from '@tiptap/pm/state';
import type { DecorationSet } from '@tiptap/pm/view';

export interface SelectionGuardState {
  decorations: DecorationSet;
  editorHasFocus: boolean;
  /**
   * Document position where the primary button went down next to a token, while the
   * press lasts. A click there puts the caret at it; a drag selects from it.
   */
  pressPos: number | null;
  /**
   * Document position of a mousedown that arrived before the editor had focus. The caret
   * is put there on focus, because focusing can reflow the layout (e.g. :focus-within).
   */
  prefocusClickPos: number | null;
}

export const selectionGuardKey = new PluginKey<SelectionGuardState>('selectionGuard');

/**
 * A change to the press and focus state. A member that is present replaces the stored
 * one; an absent member is left unchanged.
 */
export type SelectionGuardMeta = Partial<
  Pick<SelectionGuardState, 'editorHasFocus' | 'pressPos' | 'prefocusClickPos'>
>;

export function setSelectionGuardMeta(tr: Transaction, meta: SelectionGuardMeta): Transaction {
  return tr.setMeta(selectionGuardKey, meta);
}

export function getSelectionGuardMeta(tr: Transaction): SelectionGuardMeta | undefined {
  return tr.getMeta(selectionGuardKey);
}
