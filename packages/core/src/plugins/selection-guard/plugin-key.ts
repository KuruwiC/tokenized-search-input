/**
 * Plugin key for selection guard plugin.
 * Separated to avoid circular dependencies.
 */

import { PluginKey } from '@tiptap/pm/state';
import type { DecorationSet } from '@tiptap/pm/view';

export interface SelectionGuardState {
  decorations: DecorationSet;
  editorHasFocus: boolean;
  isDragging: boolean;
  /**
   * Document position captured at mousedown before focus.
   * Used to restore cursor position after layout changes (e.g., :focus-within reflow).
   */
  prefocusClickPos: number | null;
}

export const selectionGuardKey = new PluginKey<SelectionGuardState>('selectionGuard');
