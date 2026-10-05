import { type Editor, mergeAttributes, Node } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { programEntry, type TokenFocusEntry } from '../../plugins/token-focus';
import { isFreeTextToken } from '../../utils/node-predicates';
import { quote } from '../../utils/quoted-string';
import { ensureTokenId, generateTokenId } from '../../utils/token-id';
import { enterToken } from '../token-focus';
import { focusTokenCommand, focusTokenOnEnter, tokenNodeViewOptions } from '../token-node';
import { FreeTextTokenView } from './free-text-token-view';

export interface InsertFreeTextTokenAttrs {
  value?: string;
  quoted?: boolean;
  /** Where the caret goes in the value of a quoted token, which receives focus. */
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
    return ReactNodeViewRenderer(FreeTextTokenView, tokenNodeViewOptions(this.editor));
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

          // A quoted token is entered to type its value
          if (attrs.quoted) {
            // Use requestAnimationFrame to ensure the node is rendered
            requestAnimationFrame(() => {
              if (editor.isDestroyed || !editor.isEditable) return;
              enterToken(editor, id, programEntry(attrs.position ?? 'end'));
            });
          }

          return true;
        },

      focusFreeTextToken: focusTokenCommand(isFreeTextToken),
    };
  },

  addKeyboardShortcuts() {
    return { Enter: focusTokenOnEnter(isFreeTextToken) };
  },
});
