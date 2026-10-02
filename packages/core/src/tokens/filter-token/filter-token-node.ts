import { type Editor, mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { getEditorContext, getFocusContext } from '../../extensions/editor-context';
import { setTokenMeta, type TokenDisplayContent } from '../../plugins/shared/meta';
import {
  enterTokenIn,
  getFocusedToken,
  type LeaveDirection,
  leaveTokenIn,
  programEntry,
  type TokenFocusEntry,
} from '../../plugins/token-focus-plugin';
import { findTokenById } from '../../utils/find-token';
import { isFilterToken } from '../../utils/node-predicates';
import { ensureTokenId, generateTokenId } from '../../utils/token-id';
import { TOKEN_NODE_CLASS, updateTokenNodeView } from '../composition/node-view-update';
import { isHistoryShortcut } from '../history-shortcut';
import { createFilterTokenAttrs } from './create-attrs';
import { FilterTokenView } from './filter-token-view';

export interface InsertFilterTokenAttrs {
  key: string;
  operator: string;
  value?: string;
  /** How the token presents its value, kept in token meta rather than the document. */
  display?: TokenDisplayContent;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    filterToken: {
      insertFilterToken: (attrs: InsertFilterTokenAttrs) => ReturnType;
      /** Focuses the filter token `id` with the caret at `position` in its value. */
      focusFilterToken: (id: string, position?: TokenFocusEntry['position']) => ReturnType;
      /**
       * Leaves the focused token `id`, filter or free text, committing it with `value`
       * when one is given, and puts the caret beside it on the `direction` side.
       */
      leaveToken: (id: string, direction: LeaveDirection, value?: string) => ReturnType;
    };
  }
}

/** The delimiter lives in the editor context, so rendering needs the editor the schema was built for. */
function getDelimiter(editor: Editor | undefined): string {
  if (!editor) {
    throw new Error('[TokenizedSearchInput] filterToken can only be rendered inside an editor');
  }
  return getEditorContext(editor).delimiter;
}

export const FilterTokenNode = Node.create({
  name: 'filterToken',

  group: 'inline',

  inline: true,

  atom: true,

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
      immutable: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-immutable') === 'true',
        renderHTML: (attrs) => (attrs.immutable ? { 'data-immutable': 'true' } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-filter-token]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { key, operator, value } = node.attrs;
    const d = getDelimiter(this.editor);

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
    const d = getDelimiter(this.editor);
    return `${key}${d}${operator}${d}${value}`;
  },

  addNodeView() {
    const editor = this.editor;

    return ReactNodeViewRenderer(FilterTokenView, {
      className: TOKEN_NODE_CLASS,
      update: updateTokenNodeView,
      stopEvent: ({ event }) => {
        // When disabled, let all events flow to ProseMirror (don't handle in NodeView)
        if (!editor.isEditable) {
          return false;
        }

        // Undo and redo go to the editor, which owns the history of token edits
        if (event instanceof KeyboardEvent && isHistoryShortcut(event)) {
          return false;
        }

        const target = event.target as HTMLElement;

        // Always stop events on form elements and token blocks to allow interaction
        if (target.closest('input, select, button, [data-token-block]')) {
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
          const { schema, selection } = state;
          const tokenAttrs = createFilterTokenAttrs({
            key: attrs.key,
            operator: attrs.operator,
            value: attrs.value,
            source: getEditorContext(this.editor),
          });
          const tokenNode = schema.nodes.filterToken.create(tokenAttrs);
          if (attrs.display) {
            setTokenMeta(tr, tokenAttrs.id, {
              display: { ...attrs.display, forKey: tokenAttrs.key, forValue: tokenAttrs.value },
            });
          }

          tr.insert(selection.from, tokenNode);

          if (dispatch) {
            dispatch(tr);
          }

          return true;
        },

      focusFilterToken:
        (id: string, position: TokenFocusEntry['position'] = 'end') =>
        ({ tr, state, dispatch, editor }) => {
          const found = findTokenById(tr.doc, id);
          if (!found || !isFilterToken(found.node)) return false;
          if (!dispatch) return true;
          return enterTokenIn(tr, getFocusContext(editor, state), id, programEntry(position));
        },

      leaveToken:
        (id: string, direction: LeaveDirection, value?: string) =>
        ({ tr, state, dispatch, editor }) => {
          if (getFocusedToken(state)?.id !== id) return false;
          if (dispatch) leaveTokenIn(tr, getFocusContext(editor, state), id, { direction, value });
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

        if (node && isFilterToken(node) && getFocusedToken(editor.state) === null) {
          return editor.commands.focusFilterToken(String(node.attrs.id), 'end');
        }

        return false;
      },
    };
  },
});
