/**
 * Selection Invariant Plugin
 *
 * A text selection whose ends fall where the caret may not sit (inside an atom, or
 * between blocks) is moved to the nearest position where it may, in the direction the
 * selection was moving. Every other position is left alone: the caret may sit next to
 * a token, and entering a token is an explicit action of its own.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { nearestValidCaret } from '../utils/caret';

export const selectionInvariantKey = new PluginKey('selectionInvariant');

export const SelectionInvariantExtension = Extension.create({
  name: 'selectionInvariant',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: selectionInvariantKey,

        appendTransaction(transactions, oldState, newState) {
          if (transactions.some((tr) => tr.getMeta('composition'))) return null;

          const { selection, doc } = newState;
          if (!(selection instanceof TextSelection)) return null;

          const direction = selection.head >= oldState.selection.head ? 1 : -1;
          const anchor = nearestValidCaret(doc, selection.anchor, direction);
          const head = nearestValidCaret(doc, selection.head, direction);
          if (anchor === selection.anchor && head === selection.head) return null;

          return newState.tr
            .setSelection(TextSelection.create(doc, anchor, head))
            .setMeta('addToHistory', false);
        },
      }),
    ];
  },
});
