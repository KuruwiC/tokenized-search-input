/**
 * Selection guard keyboard handler types.
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { safeResolve } from '../../utils/safe-resolve';

/**
 * Context for selection guard keyboard handlers.
 * Contains all state needed to handle keyboard events at ProseMirror level.
 */
export interface SelectionGuardContext {
  /** ProseMirror editor view */
  view: EditorView;
  /** The keyboard event */
  event: KeyboardEvent;
  /** Current selection */
  selection: Selection;
  /** Document */
  doc: ProseMirrorNode;
  /** Node before the cursor position (null if at start) */
  nodeBefore: ProseMirrorNode | null;
  /** Node after the cursor position (null if at end) */
  nodeAfter: ProseMirrorNode | null;
}

/**
 * Build a SelectionGuardContext from view and event.
 */
export function buildSelectionGuardContext(
  view: EditorView,
  event: KeyboardEvent
): SelectionGuardContext {
  const { selection } = view.state;
  const { doc } = view.state;

  let nodeBefore: ProseMirrorNode | null = null;
  let nodeAfter: ProseMirrorNode | null = null;

  const $pos = safeResolve(doc, selection.from);
  if ($pos) {
    nodeBefore = $pos.nodeBefore;
    nodeAfter = $pos.nodeAfter;
  }

  return {
    view,
    event,
    selection,
    doc,
    nodeBefore,
    nodeAfter,
  };
}
