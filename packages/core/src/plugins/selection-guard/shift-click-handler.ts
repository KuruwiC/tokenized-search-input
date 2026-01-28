/**
 * Shift+Click Selection Handler
 *
 * Handles Shift+click range selection at mousedown.
 * Separated from click-resolver.ts to maintain pure function separation:
 * - click-resolver.ts: Pure position calculation (no DOM/events)
 * - shift-click-handler.ts: Event handling with ProseMirror dispatch
 */

import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { isToken } from '../../utils/node-predicates';
import { calculateShiftClickHead } from './click-resolver';
import { markAsGuarded } from './utils';

export interface PosInfo {
  pos: number;
  inside: number;
}

/**
 * Handle Shift+click range selection.
 *
 * Must be processed at mousedown to prevent ProseMirror's default selection handling
 * which fails on spacer boundaries (selectable: false).
 *
 * @param view - ProseMirror editor view
 * @param event - Mouse event
 * @param posInfo - Position info from view.posAtCoords
 * @returns true if handled, false to let ProseMirror handle
 */
export function handleShiftClickSelection(
  view: EditorView,
  event: MouseEvent,
  posInfo: PosInfo
): boolean {
  // Only handle Shift+click without other modifiers
  if (!event.shiftKey || event.metaKey || event.ctrlKey) {
    return false;
  }

  const { doc, selection } = view.state;
  const anchor = selection.anchor;

  // Determine if click was on a token using posAtCoords.inside
  const clickedNode = posInfo.inside >= 0 ? doc.nodeAt(posInfo.inside) : null;
  const clickedOnToken = clickedNode !== null && isToken(clickedNode);

  const head = calculateShiftClickHead(doc, posInfo.pos, anchor, clickedOnToken);

  // null means let ProseMirror handle (plain text areas)
  if (head === null) {
    return false;
  }

  event.preventDefault();
  const tr = view.state.tr;
  tr.setSelection(TextSelection.create(tr.doc, anchor, head));
  view.dispatch(markAsGuarded(tr));

  // Ensure editor has focus for subsequent keyboard input
  if (!view.hasFocus()) {
    view.focus();
  }

  return true;
}
