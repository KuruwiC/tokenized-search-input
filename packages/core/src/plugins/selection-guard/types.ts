import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { safeResolve } from '../../utils/safe-resolve';
import type { FocusTransitionContext } from '../token-focus';

/** What a selection guard key handler needs to handle a key press. */
export interface SelectionGuardContext {
  view: EditorView;
  event: KeyboardEvent;
  selection: Selection;
  doc: ProseMirrorNode;
  /** Node before the selection start (null at the start of a block) */
  nodeBefore: ProseMirrorNode | null;
  /** Node after the selection start (null at the end of a block) */
  nodeAfter: ProseMirrorNode | null;
  focus: FocusTransitionContext;
}

/** A condition on the context of a key press. */
export type Predicate = (ctx: SelectionGuardContext) => boolean;

/** Handles a key press; returns true when it did, which stops the keys after it. */
export type KeyHandler = (ctx: SelectionGuardContext) => boolean;

export function buildSelectionGuardContext(
  view: EditorView,
  event: KeyboardEvent,
  focus: FocusTransitionContext
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
    focus,
  };
}
