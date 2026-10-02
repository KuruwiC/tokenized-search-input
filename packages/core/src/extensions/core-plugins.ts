import { Extension } from '@tiptap/core';
import { createSelectionGuardPlugin } from '../plugins/selection-guard-plugin';
import { createSuggestionPlugin } from '../plugins/suggestion-plugin';
import { createTokenFocusPlugin } from '../plugins/token-focus-plugin';

/** The low priority keeps these plugins behind every other extension's, so they see transactions last. */
export const CorePluginsExtension = Extension.create({
  name: 'corePlugins',

  priority: 1,

  addProseMirrorPlugins() {
    return [createTokenFocusPlugin(), createSuggestionPlugin(), createSelectionGuardPlugin()];
  },
});
