/**
 * Plugin key for selection guard plugin.
 * Separated to avoid circular dependencies.
 */

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
   * Document position captured at mousedown before focus.
   * Used to restore cursor position after layout changes (e.g., :focus-within reflow).
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
