import { Fragment, type Node as ProseMirrorNode, type Schema, Slice } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import type { DeserializeTextFn } from '../../extensions/editor-context';
import {
  type ParseQueryStringResult,
  parseQueryStringWithInfo,
  parseTokenText,
  type SerializedToken,
} from '../../serializer';
import { createFilterTokenAttrs } from '../../tokens/filter-token/create-attrs';
import type { FieldDefinition, FreeTextMode, UnknownFieldTemplate } from '../../types';
import { isFreeTextToken, isToken } from '../../utils/node-predicates';
import { setTokenFocus } from '../token-focus-plugin';
import { getFreeTextStrategy } from './free-text-strategy';

export interface TokenizeContext {
  fields: FieldDefinition[];
  freeTextMode: FreeTextMode;
  unknownFields?: UnknownFieldTemplate | undefined;
  deserializeText?: DeserializeTextFn | undefined;
  delimiter?: string | undefined;
}

function parse(text: string, ctx: TokenizeContext): ParseQueryStringResult {
  const custom = ctx.deserializeText?.(text);
  if (custom != null) {
    const tokens: SerializedToken[] = custom.map((token) =>
      token.type === 'freeText' ? { ...token, quoted: false } : token
    );
    return { tokens, hasIncompleteQuote: false };
  }
  return parseQueryStringWithInfo(text, ctx.fields, {
    unknownFields: ctx.unknownFields,
    delimiter: ctx.delimiter,
  });
}

/** A field key and delimiter still waiting for a value: the start of a filter, not free text. */
function isFilterWithoutValue(token: SerializedToken, ctx: TokenizeContext): boolean {
  if (token.type !== 'freeText' || token.quoted) return false;
  const parsed = parseTokenText(token.value, ctx.fields, {
    unknownFields: ctx.unknownFields,
    delimiter: ctx.delimiter,
  });
  return parsed !== null && !parsed.value;
}

function toNodes(
  tokens: SerializedToken[],
  schema: Schema,
  ctx: TokenizeContext
): ProseMirrorNode[] {
  const strategy = getFreeTextStrategy(ctx.freeTextMode);
  const nodes: ProseMirrorNode[] = [];
  for (const token of tokens) {
    let node: ProseMirrorNode | null = null;
    if (token.type === 'filter') {
      const attrs = createFilterTokenAttrs({
        key: token.key,
        operator: token.operator,
        value: token.value,
        source: { fields: ctx.fields, unknownFields: ctx.unknownFields },
      });
      node = schema.nodes.filterToken.create(attrs);
    } else if (isFilterWithoutValue(token, ctx)) {
      node = schema.text(token.value);
    } else if (token.value.trim()) {
      const content = strategy.toDocContent(token);
      node = content ? schema.nodeFromJSON(content) : null;
    }
    if (!node) continue;
    // Two plain-text words would otherwise merge into one text node.
    if (node.isText && nodes[nodes.length - 1]?.isText) nodes.push(schema.text(' '));
    nodes.push(node);
  }
  return nodes;
}

/** Keeps the whitespace `text` starts and ends with where the content there stays text. */
function keepEdgeWhitespace(nodes: ProseMirrorNode[], text: string, schema: Schema): void {
  const first = nodes[0];
  const lead = /^\s+/.exec(text)?.[0];
  if (lead && first?.isText) nodes[0] = schema.text(lead + first.text);
  const last = nodes[nodes.length - 1];
  const trail = /\s+$/.exec(text)?.[0];
  if (trail && last?.isText) nodes[nodes.length - 1] = schema.text(last.text + trail);
}

function focusLastQuotedToken(tr: Transaction, from: number, to: number): void {
  let focusedPos: number | null = null;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (isFreeTextToken(node) && node.attrs.quoted) focusedPos = pos;
    return true;
  });
  if (focusedPos !== null) setTokenFocus(tr, { focusedPos, cursorPosition: 'end' });
}

interface TextRun {
  from: number;
  to: number;
  text: string;
}

function tokenizeRun(tr: Transaction, run: TextRun, ctx: TokenizeContext): boolean {
  const { schema } = tr.doc.type;
  const { tokens, hasIncompleteQuote } = parse(run.text, ctx);
  const nodes = toNodes(tokens, schema, ctx);
  if (!nodes.some(isToken)) return false;
  keepEdgeWhitespace(nodes, run.text, schema);

  const before = Fragment.from(schema.text(run.text));
  const after = Fragment.from(nodes);
  const start = before.findDiffStart(after);
  const end = before.findDiffEnd(after);
  if (start === null || !end) return false;
  // Where text repeats around the change, the common end can reach back past `start`.
  const overlap = Math.max(0, start - Math.min(end.a, end.b));

  const caret = tr.selection.from;
  const caretInRun = caret > run.from && caret <= run.to;
  const content = after.cut(start, end.b + overlap);
  tr.replace(run.from + start, run.from + end.a + overlap, new Slice(content, 0, 0));
  if (hasIncompleteQuote && caretInRun && ctx.freeTextMode === 'tokenize') {
    focusLastQuotedToken(tr, run.from + start, run.from + start + content.size);
  }
  return true;
}

/**
 * Reads the text between `from` and `to` in `tr.doc` as a query and puts in the tokens
 * it contains. Only what changes is replaced, so text that stays text keeps its place,
 * and text without tokens is left as it is. In tokenize mode, a quote left open at the
 * caret leaves its free text token focused for the rest of the input.
 *
 * @returns whether the document changed
 */
export function tokenizeRange(
  tr: Transaction,
  from: number,
  to: number,
  ctx: TokenizeContext
): boolean {
  const runs: TextRun[] = [];
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return true;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    if (start < end)
      runs.push({ from: start, to: end, text: node.textBetween(start - pos, end - pos) });
    return false;
  });
  let changed = false;
  for (const run of runs.reverse()) {
    if (tokenizeRun(tr, run, ctx)) changed = true;
  }
  return changed;
}
