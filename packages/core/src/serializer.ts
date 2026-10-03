/**
 * The query grammar, written out in docs/query-grammar.md.
 *
 * A query is segments separated by spaces; only a space separates segments. A segment is
 * `key<d>operator<d>value` (`<d>` is the delimiter) or free text. A value and free text may
 * be wrapped in `"`; inside quotes the only escapes are `\"` and `\\`, and newlines and tabs
 * stand for themselves. A value or free text is written in quotes when it holds any
 * whitespace character, a quote or a backslash, or when free text starts as a key and the
 * delimiter. `tokenizeQuery` is the one tokenizer that reads queries and `quote` the one
 * function that writes quotes. What cannot be read as written is kept and reported in the
 * diagnostics of the result: an open quote, a key that matches no field, an operator its
 * field does not allow.
 */
import type { JSONContent } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import {
  getFreeTextStrategy,
  type ParsedFreeTextToken,
} from './plugins/auto-tokenize/free-text-strategy';
import { getTokenMeta } from './plugins/token-meta-plugin';
import { knownOperators, readWord } from './serializer/read-word';
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

export interface ParsedQuery {
  doc: JSONContent;
  diagnostics: ParseDiagnostics;
}

export function parseQueryToDoc(
  query: string,
  fields: FieldDefinition[],
  options: ParseOptions = {}
): ParsedQuery {
  const freeTextMode: FreeTextMode = options.freeTextMode ?? 'plain';
  const delimiter = options.delimiter ?? DEFAULT_TOKEN_DELIMITER;
  const { tokens, diagnostics } = parseQueryString(query, fields, {
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
    doc: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: content.length > 0 ? content : undefined,
        },
      ],
    },
    diagnostics,
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

  const reading = readWord(
    { key, rest },
    { fields, unknownFields: options?.unknownFields },
    delimiter,
    knownOperators(fields, options?.unknownFields)
  );
  if (reading?.type !== 'filter') return null;
  return { key: reading.key, operator: reading.operator, value: reading.value };
}

export type SerializedToken = FilterToken | ParsedFreeTextToken;

/** What a query held that could not be read as it was written. */
export interface ParseDiagnostics {
  /** A quote was left open and runs to the end of the query. */
  incompleteQuote: boolean;
  /** Keys that start a segment as `key<delimiter>` and match no field, each once. These stay free text unless `unknownFields` allows them. */
  unknownFields: string[];
  /** Operators the editor knows that the field of the key does not allow, each pair once. The tokens keep them and are marked invalid by validation. */
  unknownOperators: { key: string; operator: string }[];
}

export function emptyDiagnostics(): ParseDiagnostics {
  return { incompleteQuote: false, unknownFields: [], unknownOperators: [] };
}

export interface ParseQueryStringResult {
  tokens: Array<SerializedToken>;
  diagnostics: ParseDiagnostics;
}

export function parseQueryString(
  query: string,
  fields: FieldDefinition[],
  options?: ParseOptions
): ParseQueryStringResult {
  const tokens: Array<SerializedToken> = [];
  const diagnostics = emptyDiagnostics();
  const delimiter = options?.delimiter ?? DEFAULT_TOKEN_DELIMITER;
  const source = { fields, unknownFields: options?.unknownFields };
  const known = knownOperators(fields, options?.unknownFields);

  for (const segment of tokenizeQuery(query, delimiter)) {
    if (!segment.closed) diagnostics.incompleteQuote = true;

    if (segment.type === 'quoted') {
      tokens.push({
        type: 'freeText',
        value: segment.value,
        quoted: true,
        rawText: segment.raw,
      });
      continue;
    }

    const reading =
      segment.key === null
        ? null
        : readWord({ key: segment.key, rest: segment.rest }, source, delimiter, known);
    if (reading?.type === 'filter' && reading.value) {
      tokens.push({
        type: 'filter',
        key: reading.key,
        operator: reading.operator,
        value: reading.value,
      });
      if (reading.unknownOperator) {
        const { key, operator } = reading;
        if (!diagnostics.unknownOperators.some((o) => o.key === key && o.operator === operator)) {
          diagnostics.unknownOperators.push({ key, operator });
        }
      }
      continue;
    }
    if (reading?.type === 'unknownField' && !diagnostics.unknownFields.includes(reading.key)) {
      diagnostics.unknownFields.push(reading.key);
    }
    tokens.push({ type: 'freeText', value: segment.raw, quoted: false });
  }

  return { tokens, diagnostics };
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
