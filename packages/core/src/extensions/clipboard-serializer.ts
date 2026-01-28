import { Extension } from '@tiptap/core';
import type { Fragment, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DEFAULT_TOKEN_DELIMITER, type FilterTokenAttrs } from '../types';
import { NODE_TYPE_NAMES } from '../utils/node-predicates';
import { escapeForQuotes, quoteIfNeeded } from '../utils/quoted-string';

/** Return null to use default serialization for that token. */
export type SerializeTokenFn = (token: FilterTokenAttrs) => string | null;

interface FragmentNode {
  type: { name: string };
  attrs?: Record<string, unknown>;
  text?: string;
  content?: FragmentLike;
}

interface FragmentLike {
  forEach: (fn: (node: FragmentNode) => void) => void;
}

interface SerializeOptions {
  serializeToken?: SerializeTokenFn;
  delimiter: string;
}

function defaultSerializeFilterToken(node: FragmentNode, parts: string[], delimiter: string): void {
  const { key, operator, value } = node.attrs || {};
  const valueStr = String(value || '');
  if (valueStr) {
    const quotedValue = quoteIfNeeded(valueStr);
    parts.push(`${key}${delimiter}${operator}${delimiter}${quotedValue}`);
  }
}

function serializeFreeTextToken(node: FragmentNode, parts: string[]): void {
  const { value, quoted } = node.attrs || {};
  if (value) {
    parts.push(quoted ? `"${escapeForQuotes(String(value))}"` : String(value));
  }
}

function serializeText(node: FragmentNode, parts: string[]): void {
  parts.push(node.text || '');
}

function visitFragment(fragment: FragmentLike, parts: string[], options: SerializeOptions): void {
  const visit = (content: FragmentLike) => visitFragment(content, parts, options);

  fragment.forEach((node) => {
    switch (node.type.name) {
      case NODE_TYPE_NAMES.filterToken: {
        // Try custom serializer first
        if (options.serializeToken && node.attrs) {
          const attrs = node.attrs as unknown as FilterTokenAttrs;
          const result = options.serializeToken(attrs);
          if (result !== null) {
            if (result) parts.push(result);
            break;
          }
        }
        // Fall back to default
        defaultSerializeFilterToken(node, parts, options.delimiter);
        break;
      }
      case NODE_TYPE_NAMES.freeTextToken:
        serializeFreeTextToken(node, parts);
        break;
      case 'text':
        serializeText(node, parts);
        break;
      case 'paragraph':
        if (node.content) {
          visit(node.content);
        }
        break;
      default:
        if (node.content) {
          visit(node.content);
        }
        break;
    }
  });
}

function serializeFragment(fragment: FragmentLike, options: SerializeOptions): string {
  const parts: string[] = [];
  visitFragment(fragment, parts, options);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function containsTokenNodes(fragment: Fragment): boolean {
  let hasToken = false;
  fragment.forEach((node) => {
    if (hasToken) return;
    if (
      node.type.name === NODE_TYPE_NAMES.filterToken ||
      node.type.name === NODE_TYPE_NAMES.freeTextToken
    ) {
      hasToken = true;
    } else if (node.content && node.content.size > 0) {
      if (containsTokenNodes(node.content)) {
        hasToken = true;
      }
    }
  });
  return hasToken;
}

function serializeSliceToText(slice: Slice, options: SerializeOptions): string {
  if (!containsTokenNodes(slice.content)) {
    return slice.content.textBetween(0, slice.content.size, '\n\n');
  }
  return serializeFragment(slice.content, options);
}

export interface ClipboardSerializerOptions {
  serializeToken?: SerializeTokenFn;
  delimiter?: string;
}

/**
 * Writes only plain text to clipboard on copy/cut when token nodes are present.
 * This prevents ProseMirror from restoring tokens from HTML on paste,
 * ensuring paste goes through useAutoTokenize for proper parsing.
 */
export const ClipboardSerializer = Extension.create<ClipboardSerializerOptions>({
  name: 'clipboardSerializer',

  addOptions() {
    return {
      serializeToken: undefined,
      delimiter: DEFAULT_TOKEN_DELIMITER,
    };
  },

  addProseMirrorPlugins() {
    const { serializeToken, delimiter = DEFAULT_TOKEN_DELIMITER } = this.options;

    return [
      new Plugin({
        key: new PluginKey('clipboardSerializer'),
        props: {
          clipboardTextSerializer: (slice: Slice): string => {
            return serializeSliceToText(slice, { serializeToken, delimiter });
          },

          handleDOMEvents: {
            copy: (view, event) => {
              const { state } = view;
              const { selection } = state;

              if (selection.empty) return false;

              const slice = selection.content();

              if (!containsTokenNodes(slice.content)) return false;

              const clipboardEvent = event as ClipboardEvent;
              // Safari browser menu fires copy events without clipboardData
              if (!clipboardEvent.clipboardData) return false;

              const text = serializeSliceToText(slice, { serializeToken, delimiter });
              clipboardEvent.clipboardData.setData('text/plain', text);
              clipboardEvent.preventDefault();
              return true;
            },

            cut: (view, event) => {
              const { state, dispatch } = view;
              const { selection } = state;

              if (selection.empty) return false;

              const slice = selection.content();

              if (!containsTokenNodes(slice.content)) return false;

              const clipboardEvent = event as ClipboardEvent;
              if (!clipboardEvent.clipboardData) return false;

              const text = serializeSliceToText(slice, { serializeToken, delimiter });
              clipboardEvent.clipboardData.setData('text/plain', text);
              clipboardEvent.preventDefault();

              dispatch(state.tr.deleteSelection().scrollIntoView());
              return true;
            },
          },
        },
      }),
    ];
  },
});
