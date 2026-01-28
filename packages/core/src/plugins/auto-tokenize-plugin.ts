import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import {
  buildContentFromTokens,
  collectTokenizableTextNodes,
  wrapWithSpacers,
} from '../editor/auto-tokenize';
import type { DeserializeTextFn } from '../extensions/editor-context';
import { setTokenFocus } from '../plugins/token-focus-plugin';
import { type ParseQueryStringResult, parseQueryStringWithInfo } from '../serializer';
import type { FieldDefinition, FreeTextMode } from '../types';
import { isFreeTextToken } from '../utils/node-predicates';
import { FORCE_VALIDATION_CHECK } from './validation-plugin';

const DEBOUNCE_MS = 50;

export const autoTokenizeKey = new PluginKey('autoTokenize');

export interface AutoTokenizeContext {
  fields: FieldDefinition[];
  freeTextMode: FreeTextMode;
  allowUnknownFields?: boolean;
  unknownFieldOperators?: readonly string[];
  deserializeText?: DeserializeTextFn;
  delimiter?: string;
}

interface AutoTokenizeState {
  lastDocSize: number;
}

function isBulkInsertion(oldState: EditorState, newState: EditorState): boolean {
  const sizeChange = newState.doc.content.size - oldState.doc.content.size;
  return sizeChange > 1;
}

function isHistoryOperation(tr: Transaction): boolean {
  const historyMeta = tr.getMeta('history$');
  return !!(historyMeta && (historyMeta as { redo?: boolean }).redo !== undefined);
}

function jsonToNodes(schema: Schema, content: JSONContent[]): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];
  for (const item of content) {
    if (!item.type) continue;

    // Text nodes must be created with schema.text(), not nodeType.create()
    if (item.type === 'text' && item.text) {
      nodes.push(schema.text(item.text));
      continue;
    }

    const nodeType = schema.nodes[item.type];
    if (nodeType) {
      const node = nodeType.create(item.attrs || {});
      nodes.push(node);
    }
  }
  return nodes;
}

function tokenizeAllTextNodes(
  state: EditorState,
  context: AutoTokenizeContext,
  forceCursorText: boolean
): Transaction | null {
  const {
    fields,
    freeTextMode,
    allowUnknownFields,
    unknownFieldOperators,
    deserializeText,
    delimiter,
  } = context;
  const { doc, selection, schema } = state;
  const cursorPos = selection.from;

  const textNodes = collectTokenizableTextNodes(doc, cursorPos, forceCursorText);
  if (textNodes.length === 0) return null;

  const parseOptions = { allowUnknownFields, unknownFieldOperators, delimiter };

  const tr = state.tr;
  let didTokenize = false;
  let incompleteQuoteTokenPos: number | null = null;

  for (let i = textNodes.length - 1; i >= 0; i--) {
    const { pos, nodeEnd, text, containsCursor } = textNodes[i];

    const currentNode = tr.doc.nodeAt(pos);
    if (!currentNode?.isText || currentNode.text !== text) continue;

    let parseResult: ParseQueryStringResult;

    // Try custom deserializer first, fallback to default if it returns null
    const customResult = deserializeText?.(text);
    if (customResult !== null && customResult !== undefined) {
      // Convert types.ParsedToken to serializer.ParsedToken format (add quoted: false for freetext)
      const convertedTokens = customResult.map((token) =>
        token.type === 'freeText' ? { ...token, quoted: false } : token
      );
      parseResult = { tokens: convertedTokens, hasIncompleteQuote: false };
    } else {
      parseResult = parseQueryStringWithInfo(text, fields, parseOptions);
    }

    const content = buildContentFromTokens(parseResult.tokens, fields, freeTextMode);

    if (content.length === 0) continue;

    const finalContent = wrapWithSpacers(content);

    const nodes = jsonToNodes(schema, finalContent);
    if (nodes.length === 0) continue;

    // Delete existing content and insert new nodes
    // (doc-invariant-plugin handles paragraph normalization)
    if (pos !== nodeEnd) {
      tr.delete(pos, nodeEnd);
    }
    for (let i = nodes.length - 1; i >= 0; i--) {
      tr.insert(pos, nodes[i]);
    }
    didTokenize = true;

    if (parseResult.hasIncompleteQuote && containsCursor && freeTextMode === 'tokenize') {
      let lastFreeTextPos: number | null = null;
      tr.doc.descendants((node, nodePos) => {
        if (isFreeTextToken(node) && node.attrs.quoted) {
          lastFreeTextPos = nodePos;
        }
        return true;
      });
      incompleteQuoteTokenPos = lastFreeTextPos;
    }
  }

  if (!didTokenize) return null;

  if (incompleteQuoteTokenPos !== null) {
    setTokenFocus(tr, {
      focusedPos: incompleteQuoteTokenPos,
      cursorPosition: 'end',
    });
  }

  return tr.setMeta(autoTokenizeKey, true);
}

export function createAutoTokenizePlugin(getContext: () => AutoTokenizeContext): Plugin {
  let pendingDebounce: ReturnType<typeof setTimeout> | null = null;
  let viewRef: EditorView | null = null;

  return new Plugin({
    key: autoTokenizeKey,

    state: {
      init(_, state): AutoTokenizeState {
        return { lastDocSize: state.doc.content.size };
      },
      apply(tr, value, _, newState): AutoTokenizeState {
        if (tr.docChanged) {
          return { lastDocSize: newState.doc.content.size };
        }
        return value;
      },
    },

    view(view) {
      viewRef = view;
      return {
        destroy() {
          viewRef = null;
          if (pendingDebounce) {
            clearTimeout(pendingDebounce);
            pendingDebounce = null;
          }
        },
      };
    },

    appendTransaction(transactions, oldState, newState) {
      if (transactions.some((tr) => tr.getMeta(autoTokenizeKey))) {
        return null;
      }

      if (!transactions.some((tr) => tr.docChanged)) {
        return null;
      }

      if (transactions.some((tr) => isHistoryOperation(tr))) {
        return null;
      }

      const context = getContext();
      const bulk = isBulkInsertion(oldState, newState);

      if (bulk) {
        if (pendingDebounce) {
          clearTimeout(pendingDebounce);
          pendingDebounce = null;
        }

        const tr = tokenizeAllTextNodes(newState, context, true);
        if (tr) {
          tr.setMeta(FORCE_VALIDATION_CHECK, true);
        }
        return tr;
      }

      if (context.freeTextMode === 'tokenize') {
        if (pendingDebounce) {
          clearTimeout(pendingDebounce);
        }

        pendingDebounce = setTimeout(() => {
          pendingDebounce = null;
          if (!viewRef) return;

          const tr = tokenizeAllTextNodes(viewRef.state, context, false);
          if (tr) {
            tr.setMeta(FORCE_VALIDATION_CHECK, true);
            viewRef.dispatch(tr);
          }
        }, DEBOUNCE_MS);
      }

      return null;
    },
  });
}
