import { type Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { readTypedText } from '../editor/auto-tokenize';
import { canAutoTokenize } from '../editor/keyboard/guards';

const typedTextKey = new PluginKey('typedText');

/** Whether the editor itself, not a token in it, takes typed text now. */
function readsTypedText(editor: Editor, view: EditorView): boolean {
  return editor.isEditable && !view.composing && canAutoTokenize(editor);
}

/**
 * Reads the text a composition committed before the caret, once ProseMirror has applied it
 * and ended the composition. The text has to be the text right before the caret, and the
 * editor has to keep focus, so a composition the user moved away from is left as it is.
 */
function readCommittedText(editor: Editor, view: EditorView, committed: string): void {
  if (editor.isDestroyed || !readsTypedText(editor, view) || !view.hasFocus()) return;
  const { selection, doc } = view.state;
  if (!selection.empty) return;
  const to = selection.from;
  const from = to - committed.length;
  if (from < 0 || !doc.resolve(from).sameParent(selection.$from)) return;
  if (doc.textBetween(from, to) !== committed) return;
  readTypedText(editor, { from, to, text: committed, landed: true });
}

/**
 * Hands `readTypedText` the text that lands in the document. Keys cannot tell what it is: an
 * input method composes text with keys whose keydown names no character, or inserts it with no
 * keydown at all. Text ProseMirror reads in is read at once; a composition's text after it ends.
 */
export const TypedTextExtension = Extension.create({
  name: 'typedText',

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: typedTextKey,
        props: {
          handleTextInput(view, from, to, text) {
            if (!readsTypedText(editor, view)) return false;
            return readTypedText(editor, { from, to, text, landed: false });
          },
          handleDOMEvents: {
            compositionend(view, event) {
              const committed = event.data;
              // ProseMirror applies the committed text and ends the composition after this event.
              if (committed) setTimeout(() => readCommittedText(editor, view, committed));
              return false;
            },
          },
        },
      }),
    ];
  },
});
