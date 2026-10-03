import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import {
  isAutoTokenized,
  isCompositionTransaction,
  isHistoryTransaction,
  markAutoTokenized,
  requestValidationCheck,
} from '../shared/meta';
import type { FocusTransitionContext } from '../token-focus-plugin';
import { type TokenizeContext, tokenizeRange } from './tokenize-range';

/** Marks a transaction whose text was already read as a query. */
export const autoTokenizeKey = new PluginKey('autoTokenize');

/**
 * The span of the document after `transactions` covering every place where more than
 * one position was inserted at once, as a paste or a content replacement does and a
 * keystroke does not.
 */
function insertedSpan(transactions: readonly Transaction[]): { from: number; to: number } | null {
  const maps = transactions.flatMap((tr) => tr.mapping.maps);
  const mapping = new Mapping(maps);
  let from = Number.POSITIVE_INFINITY;
  let to = Number.NEGATIVE_INFINITY;
  maps.forEach((map, index) => {
    const later = mapping.slice(index + 1);
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      if (newEnd - newStart <= 1) return;
      from = Math.min(from, later.map(newStart, -1));
      to = Math.max(to, later.map(newEnd, 1));
    });
  });
  return from < to ? { from, to } : null;
}

function wordPart(node: ProseMirrorNode | null | undefined, pattern: RegExp): number {
  return node?.isText ? (pattern.exec(node.text ?? '')?.[0].length ?? 0) : 0;
}

/** Widens `from`-`to` over the rest of a word it starts or ends inside of. */
function extendToWords(
  doc: ProseMirrorNode,
  from: number,
  to: number
): { from: number; to: number } {
  const text = doc.textBetween(from, to, ' ', ' ');
  const head = /^\S/.test(text) ? wordPart(doc.resolve(from).nodeBefore, /\S+$/) : 0;
  const tail = /\S$/.test(text) ? wordPart(doc.resolve(to).nodeAfter, /^\S+/) : 0;
  return { from: from - head, to: to + tail };
}

/**
 * Reads text that arrives in bulk, by paste or by replacing the content, as a query.
 * Typing is read by the key that ends a word instead. Undo, redo and IME composition
 * are left alone.
 */
export function createAutoTokenizePlugin(
  getContext: () => TokenizeContext,
  getFocusContext: (state: EditorState) => FocusTransitionContext
): Plugin {
  return new Plugin({
    key: autoTokenizeKey,

    appendTransaction(transactions, _oldState, newState) {
      const skip = transactions.some(
        (tr) => isAutoTokenized(tr) || isCompositionTransaction(tr) || isHistoryTransaction(tr)
      );
      if (skip) return null;

      const span = insertedSpan(transactions);
      if (!span) return null;

      const { from, to } = extendToWords(newState.doc, span.from, span.to);
      const tr = newState.tr;
      if (!tokenizeRange(tr, from, to, getContext(), getFocusContext(newState))) return null;

      requestValidationCheck(tr);
      return markAutoTokenized(tr);
    },
  });
}
