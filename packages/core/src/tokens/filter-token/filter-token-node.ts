import { type Editor, mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { getEditorContext, getFocusContext } from '../../extensions/editor-context';
import {
  getFocusedTokenId,
  type LeaveDirection,
  leaveTokenIn,
  type TokenFocusEntry,
} from '../../plugins/token-focus';
import { setTokenMeta, type TokenDisplayContent } from '../../plugins/token-meta-plugin';
import { isFilterToken } from '../../utils/node-predicates';
import { ensureTokenId, generateTokenId } from '../../utils/token-id';
import { focusTokenCommand, focusTokenOnEnter, tokenNodeViewOptions } from '../token-node';
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
    return ReactNodeViewRenderer(FilterTokenView, tokenNodeViewOptions(this.editor));
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

      focusFilterToken: focusTokenCommand(isFilterToken),

      leaveToken:
        (id: string, direction: LeaveDirection, value?: string) =>
        ({ tr, state, dispatch, editor }) => {
          if (getFocusedTokenId(state) !== id) return false;
          if (dispatch) leaveTokenIn(tr, getFocusContext(editor, state), id, { direction, value });
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return { Enter: focusTokenOnEnter(isFilterToken) };
  },
});
