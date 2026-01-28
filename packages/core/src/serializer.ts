import type { JSONContent } from '@tiptap/core';
import {
  getFreeTextStrategy,
  type ParsedFreeTextToken,
} from './editor/auto-tokenize/free-text-strategy';
import { createFilterTokenAttrs } from './tokens/filter-token/create-attrs';
import {
  ALL_OPERATORS,
  DEFAULT_TOKEN_DELIMITER,
  type FieldDefinition,
  type FilterToken,
  type FreeTextMode,
  type QuerySnapshot,
  type QuerySnapshotSegment,
} from './types';
import { resolveEnumValue } from './utils/enum-value';
import { NODE_TYPE_NAMES } from './utils/node-predicates';
import { type NodeVisitor, visitDocument } from './utils/node-visitor';
import { escapeForQuotes, parseQuotedString, quoteIfNeeded } from './utils/quoted-string';
import { ensureTokenId } from './utils/token-id';

export interface ParseQueryOptions {
  freeTextMode?: FreeTextMode;
  /**
   * Allow tokenizing fields not defined in the fields array.
   * When true, any text matching field:value or field:operator:value format
   * will be tokenized. Unknown fields default to 'is' operator.
   * @default false
   */
  allowUnknownFields?: boolean;
  /**
   * Operators allowed for unknown fields.
   * Only used when allowUnknownFields is true.
   * If not specified, all operators are allowed.
   * The first operator in this list is used as the default for field:value format.
   */
  unknownFieldOperators?: readonly string[];
  /**
   * Delimiter character used to separate field, operator, and value in tokens.
   * @default ':'
   */
  delimiter?: string;
}

export function parseQueryToDoc(
  query: string,
  fields: FieldDefinition[],
  options: ParseQueryOptions = {}
): JSONContent {
  const freeTextMode: FreeTextMode = options.freeTextMode ?? 'plain';
  const delimiter = options.delimiter ?? DEFAULT_TOKEN_DELIMITER;
  const tokens = parseQueryString(query, fields, {
    allowUnknownFields: options.allowUnknownFields,
    unknownFieldOperators: options.unknownFieldOperators,
    delimiter,
  });

  const content: JSONContent[] = [];

  // INVARIANT: Every token node must have a spacer on both sides.
  // Structure: [spacer][token1][spacer][spacer][token2][spacer]
  // This ensures natural cursor positioning between tokens.
  tokens.forEach((token) => {
    if (token.type === 'filter') {
      content.push({ type: 'spacer' });
      content.push({
        type: 'filterToken',
        attrs: createFilterTokenAttrs({
          key: token.key,
          operator: token.operator,
          value: token.value,
          fields,
        }),
      });
      content.push({ type: 'spacer' });
    } else if (token.type === 'freeText' && token.value.trim()) {
      const strategy = getFreeTextStrategy(freeTextMode);
      const docContent = strategy.toDocContent(token);
      if (docContent) {
        if (docContent.type === NODE_TYPE_NAMES.freeTextToken) {
          content.push({ type: 'spacer' });
          content.push(docContent);
          content.push({ type: 'spacer' });
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
      const { key, operator, value } = node.attrs || {};
      const valueStr = String(value || '');
      if (valueStr) {
        const quotedValue = quoteIfNeeded(valueStr);
        ctx.parts.push(`${key}${delimiter}${operator}${delimiter}${quotedValue}`);
      }
    },
    freeTextToken: (node, ctx) => {
      const { value, quoted } = node.attrs || {};
      if (value) {
        ctx.parts.push(quoted ? `"${escapeForQuotes(value)}"` : value);
      }
    },
    spacer: () => {},
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

export interface ParseTokenTextOptions {
  /**
   * Allow tokenizing fields not defined in the fields array.
   * When true, any text matching field:value or field:operator:value format
   * will be tokenized. Unknown fields default to 'is' operator.
   * @default false
   */
  allowUnknownFields?: boolean;
  /**
   * Operators allowed for unknown fields.
   * Only used when allowUnknownFields is true.
   * If not specified, all operators are allowed.
   * The first operator in this list is used as the default for field:value format.
   */
  unknownFieldOperators?: readonly string[];
  /**
   * Delimiter character used to separate field, operator, and value in tokens.
   * @default ':'
   */
  delimiter?: string;
}

export function parseTokenText(
  text: string,
  fields: FieldDefinition[],
  options?: ParseTokenTextOptions
): { key: string; operator: string; value: string } | null {
  if (!text) return null;
  if (text.startsWith('"') && text.endsWith('"')) return null;

  const delimiter = options?.delimiter ?? DEFAULT_TOKEN_DELIMITER;
  const parts = text.split(delimiter);
  if (parts.length < 2) return null;

  const [fieldKey, ...rest] = parts;
  const field = fields.find((f) => f.key === fieldKey);

  if (field) {
    const isEnumField = field.type === 'enum';

    if (rest.length >= 2 && field.operators.includes(rest[0])) {
      const rawValue = rest.slice(1).join(delimiter);
      const parsedValue = parseQuotedString(rawValue);
      const value = parsedValue.wasQuoted ? parsedValue.value : rawValue;
      const normalizedValue =
        isEnumField && field.enumValues
          ? resolveEnumValue(field.enumValues, value, { resolver: field.valueResolver })
          : value;
      return {
        key: fieldKey,
        operator: rest[0],
        value: normalizedValue,
      };
    }

    const rawValue = rest.join(delimiter);
    const parsedValue = parseQuotedString(rawValue);
    const value = parsedValue.wasQuoted ? parsedValue.value : rawValue;
    const normalizedValue =
      isEnumField && field.enumValues
        ? resolveEnumValue(field.enumValues, value, { resolver: field.valueResolver })
        : value;
    return {
      key: fieldKey,
      operator: field.operators[0],
      value: normalizedValue,
    };
  }

  if (options?.allowUnknownFields) {
    const allowedOps: readonly string[] = options.unknownFieldOperators ?? ALL_OPERATORS;
    const defaultOp = allowedOps[0] ?? 'is';

    if (rest.length >= 2 && allowedOps.includes(rest[0])) {
      const rawValue = rest.slice(1).join(delimiter);
      const parsedValue = parseQuotedString(rawValue);
      return {
        key: fieldKey,
        operator: rest[0],
        value: parsedValue.wasQuoted ? parsedValue.value : rawValue,
      };
    }

    const rawValue = rest.join(delimiter);
    const parsedValue = parseQuotedString(rawValue);
    return {
      key: fieldKey,
      operator: defaultOp,
      value: parsedValue.wasQuoted ? parsedValue.value : rawValue,
    };
  }

  return null;
}

export type SerializedToken = FilterToken | ParsedFreeTextToken;

export interface ParseQueryStringResult {
  tokens: Array<SerializedToken>;
  hasIncompleteQuote: boolean;
  incompleteQuoteValue?: string;
}

export interface ParseQueryStringOptions {
  /**
   * Allow tokenizing fields not defined in the fields array.
   * When true, any text matching field:value or field:operator:value format
   * will be tokenized. Unknown fields default to 'is' operator.
   * @default false
   */
  allowUnknownFields?: boolean;
  /**
   * Operators allowed for unknown fields.
   * Only used when allowUnknownFields is true.
   * If not specified, all operators are allowed.
   * The first operator in this list is used as the default for field:value format.
   */
  unknownFieldOperators?: readonly string[];
  /**
   * Delimiter character used to separate field, operator, and value in tokens.
   * @default ':'
   */
  delimiter?: string;
}

export function parseQueryString(
  query: string,
  fields: FieldDefinition[],
  options?: ParseQueryStringOptions
): Array<SerializedToken> {
  return parseQueryStringWithInfo(query, fields, options).tokens;
}

export function parseQueryStringWithInfo(
  query: string,
  fields: FieldDefinition[],
  options?: ParseQueryStringOptions
): ParseQueryStringResult {
  const tokens: Array<SerializedToken> = [];
  let i = 0;
  let hasIncompleteQuote = false;
  let incompleteQuoteValue: string | undefined;

  while (i < query.length) {
    while (i < query.length && query[i] === ' ') {
      i++;
    }
    if (i >= query.length) break;

    if (query[i] === '"') {
      const startPos = i;
      i++;
      let value = '';
      let escaped = false;
      let foundClosingQuote = false;

      while (i < query.length) {
        const char = query[i];
        if (escaped) {
          if (char === '"' || char === '\\') {
            value += char;
          } else {
            value += `\\${char}`;
          }
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          i++;
          foundClosingQuote = true;
          break;
        } else {
          value += char;
        }
        i++;
      }

      if (!foundClosingQuote) {
        hasIncompleteQuote = true;
        incompleteQuoteValue = value;
      }

      const rawText = query.slice(startPos, i);

      tokens.push({
        type: 'freeText',
        value,
        quoted: true,
        rawText,
      });
    } else {
      let tokenText = '';

      while (i < query.length && query[i] !== ' ') {
        const char = query[i];
        tokenText += char;
        i++;

        if (char === '"') {
          let escaped = false;
          while (i < query.length) {
            const innerChar = query[i];
            tokenText += innerChar;
            i++;
            if (escaped) {
              escaped = false;
            } else if (innerChar === '\\') {
              escaped = true;
            } else if (innerChar === '"') {
              break;
            }
          }
        }
      }

      const parsed = parseTokenText(tokenText, fields, {
        allowUnknownFields: options?.allowUnknownFields,
        unknownFieldOperators: options?.unknownFieldOperators,
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
        tokens.push({
          type: 'freeText',
          value: tokenText,
          quoted: false,
        });
      }
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
 * Creates a QuerySnapshot from a TipTap document JSON.
 * This is the recommended way to get a stable, versioned representation of the query.
 *
 * Token IDs are read from node attributes (persistent UUIDs).
 * If a node is missing an ID (e.g., legacy data), a new UUID is generated.
 */
export function createQuerySnapshot(
  doc: JSONContent,
  options: CreateQuerySnapshotOptions = {}
): QuerySnapshot {
  const delimiter = options.delimiter ?? DEFAULT_TOKEN_DELIMITER;
  const context = { segments: [] as QuerySnapshotSegment[] };

  const visitor: NodeVisitor<typeof context> = {
    filterToken: (node, ctx) => {
      const value = node.attrs?.value || '';
      if (value) {
        ctx.segments.push({
          id: ensureTokenId(node.attrs?.id),
          type: 'filter',
          key: node.attrs?.key || '',
          operator: node.attrs?.operator || 'is',
          value,
          invalid: node.attrs?.invalid || undefined,
          invalidReason: node.attrs?.invalidReason || undefined,
        });
      }
    },
    freeTextToken: (node, ctx) => {
      const value = node.attrs?.value || '';
      if (value.trim()) {
        ctx.segments.push({
          id: ensureTokenId(node.attrs?.id),
          type: 'freeText',
          value,
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
