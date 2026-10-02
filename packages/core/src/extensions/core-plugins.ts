import { Extension } from '@tiptap/core';
import { createSelectionGuardPlugin } from '../plugins/selection-guard-plugin';
import { createSuggestionPlugin } from '../plugins/suggestion-plugin';
import { createTokenFocusPlugin } from '../plugins/token-focus-plugin';
import { getEditorContext, getFocusContext, resolveField } from './editor-context';

/** The low priority keeps these plugins behind every other extension's, so they see transactions last. */
export const CorePluginsExtension = Extension.create({
  name: 'corePlugins',

  priority: 1,

  addProseMirrorPlugins() {
    const editor = this.editor;
    const resolveFieldOfEditor = (key: string) => {
      const { fields, unknownFields } = getEditorContext(editor);
      return resolveField({ fields, unknownFields }, key) ?? undefined;
    };
    return [
      createTokenFocusPlugin(),
      createSuggestionPlugin({ resolveField: resolveFieldOfEditor }),
      createSelectionGuardPlugin((state) => getFocusContext(editor, state)),
    ];
  },
});
