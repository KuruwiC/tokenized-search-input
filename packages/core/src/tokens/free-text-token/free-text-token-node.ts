import { type Editor, mergeAttributes, Node } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import {
  type CursorPosition,
  setTokenFocus,
  tokenFocusKey,
} from '../../plugins/token-focus-plugin';
import { isFreeTextToken } from '../../utils/node-predicates';
import { escapeForQuotes } from '../../utils/quoted-string';
import { ensureTokenId, generateTokenId } from '../../utils/token-id';
import { FreeTextTokenView } from './free-text-token-view';

export interface FreeTextTokenOptions {
  enabled: boolean;
}

export interface InsertFreeTextTokenAttrs {
  value?: string;
  quoted?: boolean;
  focus?: boolean;
  cursorPosition?: CursorPosition;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    freeTextToken: {
      insertFreeTextToken: (attrs: InsertFreeTextTokenAttrs) => ReturnType;
      focusFreeTextToken: (pos: number, cursorPosition?: CursorPosition) => ReturnType;
    };
  }
}

export const FreeTextTokenNode = Node.create<FreeTextTokenOptions>({
  name: 'freeTextToken',

  group: 'inline',

  inline: true,

  atom: true,

  content: '',

  selectable: true,

  addOptions() {
    return {
      enabled: true,
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-token-id') || generateTokenId(),
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
      invalid: {
        default: false,
      },
      invalidReason: {
        default: null,
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
    return quoted ? `"${escapeForQuotes(value)}"` : value;
  },

  addNodeView() {
    const editor = this.editor;

    return ReactNodeViewRenderer(FreeTextTokenView, {
      stopEvent: ({ event }) => {
        // When disabled, let all events flow to ProseMirror (don't handle in NodeView)
        if (!editor.isEditable) {
          return false;
        }

        const target = event.target as HTMLElement;

        // Always stop events on form elements to allow interaction
        if (target.closest('input, button')) {
          return true;
        }

        // mousedown is passed to ProseMirror for drag selection handling
        // selection-guard-plugin catches it and calls preventDefault() to block NodeSelection
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

          // Create nodes: spacer + freeTextToken + spacer
          const spacerNode = schema.nodes.spacer.create();
          const tokenNode = schema.nodes.freeTextToken.create({
            id: generateTokenId(),
            value: attrs.value ?? '',
            quoted: attrs.quoted ?? false,
          });
          const nodes = [spacerNode, tokenNode, spacerNode.copy()];

          // Insert nodes (doc-invariant-plugin handles paragraph normalization)
          for (let i = nodes.length - 1; i >= 0; i--) {
            tr.insert(selection.from, nodes[i]);
          }

          if (dispatch) {
            dispatch(tr);
          }

          // Focus the token after insertion if it's quoted
          if (attrs.focus !== false && attrs.quoted) {
            // Use requestAnimationFrame to ensure the node is rendered
            requestAnimationFrame(() => {
              // Guard: check if editor is still available and editable
              if (editor.isDestroyed || !editor.isEditable) return;

              let tokenPos: number | null = null;
              editor.state.doc.descendants((node, pos) => {
                if (isFreeTextToken(node) && node.attrs.quoted) {
                  tokenPos = pos;
                  return false;
                }
                return true;
              });

              if (tokenPos !== null) {
                const focusTr = editor.state.tr;
                setTokenFocus(focusTr, {
                  focusedPos: tokenPos,
                  cursorPosition: attrs.cursorPosition ?? 'end',
                });
                focusTr.setMeta('addToHistory', false);
                editor.view.dispatch(focusTr);
              }
            });
          }

          return true;
        },

      focusFreeTextToken:
        (pos: number, cursorPosition: CursorPosition = 'end') =>
        ({
          tr,
          state,
          dispatch,
        }: {
          tr: Transaction;
          state: EditorState;
          dispatch?: (tr: Transaction) => void;
        }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || !isFreeTextToken(node)) return false;

          if (dispatch) {
            setTokenFocus(tr, { focusedPos: pos, cursorPosition });
            tr.setMeta('addToHistory', false);
            dispatch(tr);
          }

          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        // Skip when editor is disabled
        if (!editor.isEditable) return false;

        const { selection } = editor.state;
        const node = editor.state.doc.nodeAt(selection.from);

        if (node && isFreeTextToken(node)) {
          const focusState = tokenFocusKey.getState(editor.state);
          if (focusState?.focusedPos === null) {
            editor.commands.focusFreeTextToken(selection.from, 'end');
            return true;
          }
        }

        return false;
      },
    };
  },
});
