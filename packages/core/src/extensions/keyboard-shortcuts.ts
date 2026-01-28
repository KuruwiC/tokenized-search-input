import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
  buildContext,
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
} from '../editor/keyboard';
import { getSuggestionState } from '../plugins/suggestion-plugin';
import { DEFAULT_TOKEN_DELIMITER } from '../types';
import { getEditorContextFromEditor } from './editor-context';

const delimiterKeyPluginKey = new PluginKey('delimiterKey');

// Requires EditorContextExtension to be configured with fields and callbacks.
export const KeyboardShortcutsExtension = Extension.create({
  name: 'keyboardShortcuts',

  // High priority ensures shortcuts run before other extensions
  priority: 1000,

  addKeyboardShortcuts() {
    const getEditorContextSafe = () => getEditorContextFromEditor(this.editor);

    const getCallbacks = () => {
      const ctx = getEditorContextSafe();
      return ctx.callbacks;
    };

    const getContext = () => {
      const suggestionState = getSuggestionState(this.editor.state);
      const ctx = getEditorContextSafe();
      return buildContext(
        this.editor,
        ctx.fields,
        ctx.freeTextMode,
        ctx.allowUnknownFields,
        ctx.unknownFieldOperators,
        suggestionState,
        ctx.delimiter
      );
    };

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
        if (handleEnterSubmit(ctx, callbacks)) return true;
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

            const ctx = getEditorContextFromEditor(editor);
            const delimiter = ctx.delimiter ?? DEFAULT_TOKEN_DELIMITER;

            if (event.key !== delimiter || delimiter.length !== 1) {
              return false;
            }

            const suggestionState = getSuggestionState(view.state);
            const keyboardCtx = buildContext(
              editor,
              ctx.fields,
              ctx.freeTextMode,
              ctx.allowUnknownFields,
              ctx.unknownFieldOperators,
              suggestionState,
              delimiter
            );

            return handleDelimiter(keyboardCtx);
          },
        },
      }),
    ];
  },
});
