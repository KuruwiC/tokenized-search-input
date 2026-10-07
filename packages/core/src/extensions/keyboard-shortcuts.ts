import { type Editor, Extension } from '@tiptap/core';
import { keydownHandler } from '@tiptap/pm/keymap';
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state';
import {
  handleArrowDown,
  handleArrowUp,
  handleEnterOnSuggestion,
  handleEnterSubmit,
  handleEnterTokenize,
  handleEscape,
  handleTab,
  type KeyboardContext,
} from '../editor/keyboard';
import { getSuggestionState } from '../plugins/suggestion';
import { isInputMethodKey } from '../utils/input-method-key';
import { getEditorContext } from './editor-context';

const keyboardShortcutsKey = new PluginKey('keyboardShortcuts');

function keyboardContext(editor: Editor, state: EditorState): KeyboardContext {
  return { editor, suggestionState: getSuggestionState(state) };
}

/**
 * The keys that type no text; typed text is read by TypedTextExtension once it lands.
 * Requires EditorContextExtension to be configured with fields and callbacks.
 */
export const KeyboardShortcutsExtension = Extension.create({
  name: 'keyboardShortcuts',

  // High priority ensures shortcuts run before other extensions
  priority: 1000,

  addProseMirrorPlugins() {
    const editor = this.editor;
    const getContext = () => keyboardContext(editor, editor.state);

    const handleShortcut = keydownHandler({
      ArrowDown: () => handleArrowDown(getContext()),
      ArrowUp: () => handleArrowUp(getContext()),
      Enter: () => {
        const ctx = getContext();
        const { callbacks } = getEditorContext(editor);
        if (handleEnterOnSuggestion(ctx, callbacks)) return true;
        if (handleEnterTokenize(ctx)) return true;
        if (handleEnterSubmit(ctx)) return true;
        return false;
      },
      Escape: () => handleEscape(getContext()),
      Tab: () => handleTab(getContext()),
    });

    return [
      new Plugin({
        key: keyboardShortcutsKey,
        props: {
          handleKeyDown(view, event) {
            if (!editor.isEditable || isInputMethodKey(event)) return false;
            return handleShortcut(view, event);
          },
        },
      }),
    ];
  },
});
