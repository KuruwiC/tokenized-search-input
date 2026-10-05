import { type Editor, mergeAttributes, Node } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { getFocusContext } from '../../extensions/editor-context';
import {
  enterTokenIn,
  getFocusedToken,
  programEntry,
  type TokenFocusEntry,
} from '../../plugins/token-focus';
import { findTokenById } from '../../utils/find-token';
import { isFreeTextToken } from '../../utils/node-predicates';
import { quote } from '../../utils/quoted-string';
import { ensureTokenId, generateTokenId } from '../../utils/token-id';
import { TOKEN_NODE_CLASS, updateTokenNodeView } from '../composition/node-view-update';
import { isHistoryShortcut } from '../history-shortcut';
import { enterToken } from '../token-focus';
import { FreeTextTokenView } from './free-text-token-view';

export interface InsertFreeTextTokenAttrs {
  value?: string;
  quoted?: boolean;
  focus?: boolean;
  /** Where the caret goes in the value of a quoted token that receives focus. */
  position?: TokenFocusEntry['position'];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    freeTextToken: {
      insertFreeTextToken: (attrs: InsertFreeTextTokenAttrs) => ReturnType;
      focusFreeTextToken: (id: string, position?: TokenFocusEntry['position']) => ReturnType;
    };
  }
}

export const FreeTextTokenNode = Node.create({
  name: 'freeTextToken',

  group: 'inline',

  inline: true,

  atom: true,

  content: '',

  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        // Ids are unique within a document, so content parsed from HTML always gets
        // fresh ones: pasting a copied token must not duplicate the original's id.
        parseHTML: () => generateTokenId(),
        renderHTML: (attrs) => ({ 'data-token-id': ensureTokenId(attrs.id) }),
      },
      value: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-value'),
        renderHTML: (attrs) => ({ 'data-value': attrs.value }),
      },
      quoted: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-quoted') === 'true',
        renderHTML: (attrs) => ({ 'data-quoted': String(attrs.quoted) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-free-text-token]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { value, quoted } = node.attrs;
    const displayValue = quoted ? `"${value}"` : value;

    return [
      'span',
      mergeAttributes(
        {
          'data-free-text-token': '',
          'aria-label': `Free text: ${displayValue}`,
        },
        HTMLAttributes
      ),
      displayValue,
    ];
  },

  renderText({ node }) {
    const { value, quoted } = node.attrs;
    if (!value) return '';
    return quoted ? quote(value, { always: true }) : value;
  },

  addNodeView() {
    const editor = this.editor;

    return ReactNodeViewRenderer(FreeTextTokenView, {
      className: TOKEN_NODE_CLASS,
      update: updateTokenNodeView,
      stopEvent: ({ event }) => {
        if (!editor.isEditable) {
          return false;
        }

        // Undo and redo go to the editor, which owns the history of token edits
        if (event instanceof KeyboardEvent && isHistoryShortcut(event)) {
          return false;
        }

        const target = event.target as HTMLElement;

        // Always stop events on form elements and token blocks to allow interaction
        if (target.closest('input, button, [data-token-block]')) {
          return true;
        }

        // mousedown is passed to ProseMirror for drag selection handling
        // the selection guard plugin catches it and calls preventDefault() to block NodeSelection
        if (event.type === 'mousedown') {
          return false;
        }

        // Stop click events to let React handle them (buttons, form inputs)
        if (event.type === 'click') {
          return true;
        }

        return false;
      },
    });
  },

  addCommands() {
    return {
      insertFreeTextToken:
        (attrs: InsertFreeTextTokenAttrs) =>
        ({
          tr,
          state,
          dispatch,
          editor,
        }: {
          tr: Transaction;
          state: EditorState;
          dispatch?: (tr: Transaction) => void;
          editor: Editor;
        }) => {
          const { schema, selection } = state;
          const id = generateTokenId();
          const tokenNode = schema.nodes.freeTextToken.create({
            id,
            value: attrs.value ?? '',
            quoted: attrs.quoted ?? false,
          });
          tr.insert(selection.from, tokenNode);

          if (dispatch) {
            dispatch(tr);
          }

          // Focus the token after insertion if it's quoted
          if (attrs.focus !== false && attrs.quoted) {
            // Use requestAnimationFrame to ensure the node is rendered
            requestAnimationFrame(() => {
              if (editor.isDestroyed || !editor.isEditable) return;
              enterToken(editor, id, programEntry(attrs.position ?? 'end'));
            });
          }

          return true;
        },

      focusFreeTextToken:
        (id: string, position: TokenFocusEntry['position'] = 'end') =>
        ({ tr, state, dispatch, editor }) => {
          const found = findTokenById(tr.doc, id);
          if (!found || !isFreeTextToken(found.node)) return false;
          if (!dispatch) return true;
          return enterTokenIn(tr, getFocusContext(editor, state), id, programEntry(position));
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isEditable) return false;

        const { selection } = editor.state;
        const node = editor.state.doc.nodeAt(selection.from);

        if (node && isFreeTextToken(node) && getFocusedToken(editor.state) === null) {
          return editor.commands.focusFreeTextToken(String(node.attrs.id), 'end');
        }

        return false;
      },
    };
  },
});
