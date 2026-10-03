/**
 * Shift+Click Selection Handler
 *
 * Handles Shift+click range selection at mousedown.
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { isToken } from '../../utils/node-predicates';

export interface PosInfo {
  pos: number;
  inside: number;
}

/**
 * Where a Shift+click extends the selection to, or null when the click is within text
 * and the browser extends the selection itself. A click on a token takes the whole
 * token into the selection: its end when selecting forward, its start when backward.
 */
export function shiftClickHead(
  doc: ProseMirrorNode,
  posInfo: PosInfo,
  anchor: number
): number | null {
  const clicked = posInfo.inside >= 0 ? doc.nodeAt(posInfo.inside) : null;
  if (clicked && isToken(clicked)) {
    return anchor <= posInfo.inside ? posInfo.inside + clicked.nodeSize : posInfo.inside;
  }
  const $pos = doc.resolve(posInfo.pos);
  const nextToToken =
    ($pos.nodeBefore !== null && isToken($pos.nodeBefore)) ||
    ($pos.nodeAfter !== null && isToken($pos.nodeAfter));
  return nextToToken ? posInfo.pos : null;
}

/**
 * Handle Shift+click range selection.
 *
 * Must be processed at mousedown: next to a non-editable token the browser does not
 * extend the selection reliably.
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
  const head = shiftClickHead(doc, posInfo, anchor);

  // null means let ProseMirror handle (plain text areas)
  if (head === null) {
    return false;
  }

  event.preventDefault();
  const tr = view.state.tr;
  tr.setSelection(TextSelection.create(tr.doc, anchor, head));
  view.dispatch(tr);

  // Ensure editor has focus for subsequent keyboard input
  if (!view.hasFocus()) {
    view.focus();
  }

  return true;
}
