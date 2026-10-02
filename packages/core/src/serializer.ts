import type { JSONContent } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import {
  getFreeTextStrategy,
  type ParsedFreeTextToken,
} from './plugins/auto-tokenize/free-text-strategy';
import { getTokenMeta } from './plugins/token-meta-plugin';
import { resolveTokenValue } from './serializer/resolve-token-value';
import { filterSegment, freeTextSegment } from './serializer/segments';
import { splitAtDelimiter, tokenizeQuery } from './serializer/tokenize';
import { createFilterTokenAttrs } from './tokens/filter-token/create-attrs';
import {
  DEFAULT_TOKEN_DELIMITER,
  type FieldDefinition,
  type FilterToken,
  type FreeTextMode,
  type QuerySnapshot,
  type QuerySnapshotSegment,
  type UnknownFieldTemplate,
} from './types';
import { NODE_TYPE_NAMES } from './utils/node-predicates';
import { type NodeVisitor, visitDocument } from './utils/node-visitor';
import { resolveField } from './utils/resolve-field';
import { ensureTokenId } from './utils/token-id';

export interface ParseOptions {
  /** What happens to free text; only `parseQueryToDoc` reads it. */
  freeTextMode?: FreeTextMode;
  /** Tokenizes keys not defined in `fields` using this template; when omitted they stay text. */
  unknownFields?: UnknownFieldTemplate;
  /**
   * Delimiter character used to separate field, operator, and value in tokens.
   * @default ':'
   */
  delimiter?: string;
}

export function parseQueryToDoc(
  query: string,
  fields: FieldDefinition[],
  options: ParseOptions = {}
): JSONContent {
  const freeTextMode: FreeTextMode = options.freeTextMode ?? 'plain';
  const delimiter = options.delimiter ?? DEFAULT_TOKEN_DELIMITER;
  const tokens = parseQueryString(query, fields, {
    unknownFields: options.unknownFields,
    delimiter,
  });

  const content: JSONContent[] = [];

  tokens.forEach((token) => {
    if (token.type === 'filter') {
      content.push({
        type: 'filterToken',
        attrs: createFilterTokenAttrs({
          key: token.key,
          operator: token.operator,
          value: token.value,
          source: { fields, unknownFields: options.unknownFields },
        }),
      });
    } else if (token.type === 'freeText' && token.value.trim()) {
      const strategy = getFreeTextStrategy(freeTextMode);
      const docContent = strategy.toDocContent(token);
      if (docContent) {
        if (docContent.type === NODE_TYPE_NAMES.freeTextToken) {
          content.push(docContent);
        } else {
          if (content.length > 0) {
            const lastItem = content[content.length - 1];
            if (lastItem.type === 'text') {
              content.push({ type: 'text', text: ' ' });
            }
          }
          content.push(docContent);
        }
      }
    }
  });

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: content.length > 0 ? content : undefined,
      },
    ],
  };
}

export interface SerializeDocOptions {
  /**
   * Delimiter character used to separate field, operator, and value in tokens.
   * @default ':'
   */
  delimiter?: string;
}

export function serializeDocToQuery(doc: JSONContent, options: SerializeDocOptions = {}): string {
  const delimiter = options.delimiter ?? DEFAULT_TOKEN_DELIMITER;
  const context = { parts: [] as string[] };

  const visitor: NodeVisitor<typeof context> = {
    filterToken: (node, ctx) => {
      const segment = filterSegment(node.attrs ?? {}, delimiter);
      if (segment) ctx.parts.push(segment);
    },
    freeTextToken: (node, ctx) => {
      const segment = freeTextSegment(node.attrs ?? {}, delimiter);
      if (segment) ctx.parts.push(segment);
    },
    text: (node, ctx) => {
      const text = node.text?.trim();
      if (text) {
        ctx.parts.push(text);
      }
    },
    paragraph: (_node, _ctx, visitChildren) => {
      visitChildren();
    },
  };

  visitDocument(doc, visitor, context);

  return context.parts.join(' ').trim();
}

export function parseTokenText(
  text: string,
  fields: FieldDefinition[],
  options?: ParseOptions
): { key: string; operator: string; value: string } | null {
  if (!text) return null;
  if (text.startsWith('"') && text.endsWith('"')) return null;

  const delimiter = options?.delimiter ?? DEFAULT_TOKEN_DELIMITER;
  const { key, rest } = splitAtDelimiter(text, delimiter);
  if (key === null) return null;

  const field = resolveField({ fields, unknownFields: options?.unknownFields }, key);
  if (!field) return null;

  const separator = rest.indexOf(delimiter);
  const operator = separator < 0 ? undefined : rest.slice(0, separator);
  if (operator !== undefined && (field.operators as readonly string[]).includes(operator)) {
    return {
      key,
      operator,
      value: resolveTokenValue(field, rest.slice(separator + 1)),
    };
  }

  return {
    key,
    operator: field.operators[0],
    value: resolveTokenValue(field, rest),
  };
}

export type SerializedToken = FilterToken | ParsedFreeTextToken;

export interface ParseQueryStringResult {
  tokens: Array<SerializedToken>;
  hasIncompleteQuote: boolean;
  incompleteQuoteValue?: string;
}

export function parseQueryString(
  query: string,
  fields: FieldDefinition[],
  options?: ParseOptions
): Array<SerializedToken> {
  return parseQueryStringWithInfo(query, fields, options).tokens;
}

export function parseQueryStringWithInfo(
  query: string,
  fields: FieldDefinition[],
  options?: ParseOptions
): ParseQueryStringResult {
  const tokens: Array<SerializedToken> = [];
  let hasIncompleteQuote = false;
  let incompleteQuoteValue: string | undefined;
  const delimiter = options?.delimiter ?? DEFAULT_TOKEN_DELIMITER;

  for (const segment of tokenizeQuery(query, delimiter)) {
    if (segment.type === 'quoted') {
      if (!segment.closed) {
        hasIncompleteQuote = true;
        incompleteQuoteValue = segment.value;
      }
      tokens.push({
        type: 'freeText',
        value: segment.value,
        quoted: true,
        rawText: segment.raw,
      });
      continue;
    }

    const parsed = parseTokenText(segment.raw, fields, {
      unknownFields: options?.unknownFields,
      delimiter: options?.delimiter,
    });
    if (parsed?.value) {
      tokens.push({
        type: 'filter',
        key: parsed.key,
        operator: parsed.operator,
        value: parsed.value,
      });
    } else {
      tokens.push({ type: 'freeText', value: segment.raw, quoted: false });
    }
  }

  return { tokens, hasIncompleteQuote, incompleteQuoteValue };
}

export interface CreateQuerySnapshotOptions {
  /**
   * Delimiter character used to separate field, operator, and value in tokens.
   * @default ':'
   */
  delimiter?: string;
}

/**
 * Creates a QuerySnapshot from an editor state.
 * This is the recommended way to get a stable representation of the query.
 *
 * Token IDs are read from node attributes (persistent UUIDs). Validation results
 * (`invalid`, `invalidReason`) are read from the editor's token meta, so a state
 * built without the editor's plugins reports no validation.
 */
export function createQuerySnapshot(
  state: EditorState,
  options: CreateQuerySnapshotOptions = {}
): QuerySnapshot {
  const delimiter = options.delimiter ?? DEFAULT_TOKEN_DELIMITER;
  const doc = state.doc.toJSON() as JSONContent;
  const context = { segments: [] as QuerySnapshotSegment[] };

  const visitor: NodeVisitor<typeof context> = {
    filterToken: (node, ctx) => {
      const value = node.attrs?.value || '';
      if (value) {
        const id = ensureTokenId(node.attrs?.id);
        const validation = getTokenMeta(state, id)?.validation;
        ctx.segments.push({
          id,
          type: 'filter',
          key: node.attrs?.key || '',
          operator: node.attrs?.operator || 'is',
          value,
          invalid: validation ? true : undefined,
          invalidReason: validation?.reason,
        });
      }
    },
    freeTextToken: (node, ctx) => {
      const value = node.attrs?.value || '';
      if (value.trim()) {
        const id = ensureTokenId(node.attrs?.id);
        const validation = getTokenMeta(state, id)?.validation;
        ctx.segments.push({
          id,
          type: 'freeText',
          value,
          invalid: validation ? true : undefined,
          invalidReason: validation?.reason,
        });
      }
    },
    text: (node, ctx) => {
      if (node.text) {
        ctx.segments.push({
          type: 'plaintext',
          value: node.text,
        });
      }
    },
    paragraph: (_node, _ctx, visitChildren) => {
      visitChildren();
    },
  };

  visitDocument(doc, visitor, context);

  return {
    segments: context.segments,
    text: serializeDocToQuery(doc, { delimiter }),
  };
}
