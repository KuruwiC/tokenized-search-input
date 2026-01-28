import { mergeAttributes, Node } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import {
  type CursorPosition,
  setTokenFocus,
  tokenFocusKey,
} from '../../plugins/token-focus-plugin';
import { DEFAULT_TOKEN_DELIMITER, type DefaultOperator, type FieldDefinition } from '../../types';
import { isFilterToken } from '../../utils/node-predicates';
import { ensureTokenId, generateTokenId } from '../../utils/token-id';
import { createFilterTokenAttrs } from './create-attrs';
import { FilterTokenView } from './filter-token-view';

export interface FilterTokenOptions {
  fields: FieldDefinition[];
  unknownFieldOperators?: readonly (DefaultOperator | (string & {}))[];
  /**
   * Delimiter character used to separate field, operator, and value in tokens.
   * @default ':'
   */
  delimiter?: string;
}

export interface InsertFilterTokenAttrs {
  key: string;
  operator: string;
  value?: string;
  fieldLabel?: string;
  /** Display label for aria-label and text operations (used when enumValues is empty/dynamic) */
  displayValue?: string;
  /** Content to display before the label (icon, emoji, loader) */
  startContent?: React.ReactNode;
  /** Content to display after the label (badge, indicator) */
  endContent?: React.ReactNode;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    filterToken: {
      insertFilterToken: (attrs: InsertFilterTokenAttrs) => ReturnType;
      focusFilterToken: (pos: number, cursorPosition?: CursorPosition) => ReturnType;
      blurFilterToken: () => ReturnType;
    };
  }
}

export const FilterTokenNode = Node.create<FilterTokenOptions>({
  name: 'filterToken',

  group: 'inline',

  inline: true,

  atom: true,

  selectable: true,

  addOptions() {
    return {
      fields: [],
      unknownFieldOperators: undefined,
      delimiter: DEFAULT_TOKEN_DELIMITER,
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-token-id') || generateTokenId(),
        renderHTML: (attrs) => ({ 'data-token-id': ensureTokenId(attrs.id) }),
      },
      key: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-key'),
        renderHTML: (attrs) => ({ 'data-key': attrs.key }),
      },
      operator: {
        default: 'is',
        parseHTML: (el) => el.getAttribute('data-operator'),
        renderHTML: (attrs) => ({ 'data-operator': attrs.operator }),
      },
      value: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-value') ?? '',
        renderHTML: (attrs) => ({ 'data-value': attrs.value }),
      },
      fieldLabel: {
        default: '',
      },
      invalid: {
        default: false,
      },
      invalidReason: {
        default: null,
      },
      immutable: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-immutable') === 'true',
        renderHTML: (attrs) => (attrs.immutable ? { 'data-immutable': 'true' } : {}),
      },
      displayValue: {
        default: null,
      },
      startContent: {
        default: null,
      },
      endContent: {
        default: null,
      },
      confirmed: {
        default: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-filter-token]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { key, operator, value } = node.attrs;
    const d = this.options.delimiter ?? DEFAULT_TOKEN_DELIMITER;

    return [
      'span',
      mergeAttributes(
        {
          'data-filter-token': '',
          'aria-label': `Filter: ${key} ${operator} ${value}`,
        },
        HTMLAttributes
      ),
      `${key}${d}${operator}${d}${value}`,
    ];
  },

  renderText({ node }) {
    const { key, operator, value } = node.attrs;
    if (!value) return '';
    const d = this.options.delimiter ?? DEFAULT_TOKEN_DELIMITER;
    return `${key}${d}${operator}${d}${value}`;
  },

  addNodeView() {
    const editor = this.editor;

    return ReactNodeViewRenderer(FilterTokenView, {
      stopEvent: ({ event }) => {
        // When disabled, let all events flow to ProseMirror (don't handle in NodeView)
        if (!editor.isEditable) {
          return false;
        }

        const target = event.target as HTMLElement;

        // Always stop events on form elements to allow interaction
        if (target.closest('input, select, button')) {
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
      insertFilterToken:
        (attrs: InsertFilterTokenAttrs) =>
        ({ tr, state, dispatch }) => {
          // Build overrides only with defined values
          const overrides =
            attrs.fieldLabel || attrs.displayValue || attrs.startContent || attrs.endContent
              ? {
                  fieldLabel: attrs.fieldLabel,
                  displayValue: attrs.displayValue,
                  startContent: attrs.startContent,
                  endContent: attrs.endContent,
                }
              : undefined;

          const { schema, selection } = state;
          const spacerNode = schema.nodes.spacer.create();
          const tokenNode = schema.nodes.filterToken.create(
            createFilterTokenAttrs({
              key: attrs.key,
              operator: attrs.operator,
              value: attrs.value,
              fields: this.options.fields,
              overrides,
            })
          );

          // Create nodes: spacer + token + spacer
          const nodes = [spacerNode, tokenNode, spacerNode.copy()];

          // Insert nodes (doc-invariant-plugin handles paragraph normalization)
          for (let i = nodes.length - 1; i >= 0; i--) {
            tr.insert(selection.from, nodes[i]);
          }

          if (dispatch) {
            dispatch(tr);
          }

          return true;
        },

      focusFilterToken:
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
          if (!node || !isFilterToken(node)) return false;

          if (dispatch) {
            setTokenFocus(tr, { focusedPos: pos, cursorPosition });
            tr.setMeta('addToHistory', false);
            dispatch(tr);
          }

          return true;
        },

      blurFilterToken:
        () =>
        ({ tr, dispatch }: { tr: Transaction; dispatch?: (tr: Transaction) => void }) => {
          if (dispatch) {
            setTokenFocus(tr, { focusedPos: null });
            tr.setMeta('addToHistory', false);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // When in editor (not in token), Enter on a token selects it
      Enter: ({ editor }) => {
        // Skip when editor is disabled
        if (!editor.isEditable) return false;

        const { selection } = editor.state;
        const node = editor.state.doc.nodeAt(selection.from);

        if (node && isFilterToken(node)) {
          const focusState = tokenFocusKey.getState(editor.state);
          if (focusState?.focusedPos === null) {
            editor.commands.focusFilterToken(selection.from, 'end');
            return true;
          }
        }

        return false;
      },
    };
  },
});
