import { type Editor, Extension } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
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
import { getEditorContext } from './editor-context';

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

  addKeyboardShortcuts() {
    const getCallbacks = () => getEditorContext(this.editor).callbacks;

    const getContext = () => keyboardContext(this.editor, this.editor.state);

    const ifEditable = (handler: () => boolean): (() => boolean) => {
      return () => {
        if (!this.editor.isEditable) return false;
        return handler();
      };
    };

    return {
      ArrowDown: ifEditable(() => handleArrowDown(getContext())),
      ArrowUp: ifEditable(() => handleArrowUp(getContext())),
      Enter: ifEditable(() => {
        const ctx = getContext();
        const callbacks = getCallbacks();
        if (handleEnterOnSuggestion(ctx, callbacks)) return true;
        if (handleEnterTokenize(ctx)) return true;
        if (handleEnterSubmit(ctx)) return true;
        return false;
      }),
      Escape: ifEditable(() => handleEscape(getContext())),
      Tab: ifEditable(() => handleTab(getContext())),
    };
  },
});
