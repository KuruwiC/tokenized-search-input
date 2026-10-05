import type { Command, Editor, KeyboardShortcutCommand } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { ReactNodeViewRendererOptions } from '@tiptap/react';
import { getFocusContext } from '../extensions/editor-context';
import {
  enterTokenIn,
  getFocusedToken,
  programEntry,
  type TokenFocusEntry,
} from '../plugins/token-focus';
import { findTokenById } from '../utils/find-token';
import { TOKEN_NODE_CLASS, updateTokenNodeView } from './composition/node-view-update';
import { enterToken } from './enter-token';
import { isHistoryShortcut } from './history-shortcut';

type TokenNodePredicate = (node: ProseMirrorNode) => boolean;

/**
 * Which events a token's node view keeps from ProseMirror: those on its inputs, buttons
 * and blocks, and clicks, which React handles. Undo and redo go to the editor, which
 * owns the history of token edits, and mousedown goes to ProseMirror for drag
 * selection; the selection guard plugin keeps it from making a NodeSelection.
 */
function stopTokenEvent(editor: Editor, event: Event): boolean {
  if (!editor.isEditable) return false;
  if (event instanceof KeyboardEvent && isHistoryShortcut(event)) return false;
  if ((event.target as HTMLElement).closest('input, select, button, [data-token-block]')) {
    return true;
  }
  return event.type === 'click';
}

/** The node view options both token types render with. */
export function tokenNodeViewOptions(
  editor: Editor
): Pick<ReactNodeViewRendererOptions, 'className' | 'update' | 'stopEvent'> {
  return {
    className: TOKEN_NODE_CLASS,
    update: updateTokenNodeView,
    stopEvent: ({ event }) => stopTokenEvent(editor, event),
  };
}

/** The command that moves the token focus into the token `id` of the type `isType` accepts. */
export function focusTokenCommand(
  isType: TokenNodePredicate
): (id: string, position?: TokenFocusEntry['position']) => Command {
  return (id, position = 'end') =>
    ({ tr, state, dispatch, editor }) => {
      const found = findTokenById(tr.doc, id);
      if (!found || !isType(found.node)) return false;
      if (!dispatch) return true;
      return enterTokenIn(tr, getFocusContext(editor, state), id, programEntry(position));
    };
}

/**
 * The Enter shortcut that, while no token is focused, moves the token focus into the
 * token after the caret when it is of the type `isType` accepts.
 */
export function focusTokenOnEnter(isType: TokenNodePredicate): KeyboardShortcutCommand {
  return ({ editor }) => {
    if (!editor.isEditable) return false;
    const node = editor.state.doc.nodeAt(editor.state.selection.from);
    if (!node || !isType(node) || getFocusedToken(editor.state) !== null) return false;
    return enterToken(editor, String(node.attrs.id), programEntry('end'));
  };
}
