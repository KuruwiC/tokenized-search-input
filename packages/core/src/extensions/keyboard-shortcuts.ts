import { type Editor, Extension } from '@tiptap/core';
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state';
import {
  handleArrowDown,
  handleArrowUp,
  handleDelimiter,
  handleEnterOnSuggestion,
  handleEnterSubmit,
  handleEnterTokenize,
  handleEscape,
  handleQuote,
  handleSpace,
  handleTab,
  type KeyboardContext,
} from '../editor/keyboard';
import { getSuggestionState } from '../plugins/suggestion';
import { getEditorContext } from './editor-context';

const delimiterKeyPluginKey = new PluginKey('delimiterKey');

function keyboardContext(editor: Editor, state: EditorState): KeyboardContext {
  const { freeTextMode, delimiter } = getEditorContext(editor);
  return { editor, freeTextMode, suggestionState: getSuggestionState(state), delimiter };
}

// Requires EditorContextExtension to be configured with fields and callbacks.
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
      ' ': ifEditable(() => handleSpace(getContext())),
      Tab: ifEditable(() => handleTab(getContext())),
      '"': ifEditable(() => handleQuote(getContext())),
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: delimiterKeyPluginKey,
        props: {
          handleKeyDown(view, event) {
            if (!editor.isEditable) return false;

            if (event.key !== getEditorContext(editor).delimiter) return false;
            return handleDelimiter(keyboardContext(editor, view.state));
          },
        },
      }),
    ];
  },
});
