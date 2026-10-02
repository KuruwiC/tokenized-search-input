import { Extension } from '@tiptap/core';
import { createSelectionGuardPlugin } from '../plugins/selection-guard-plugin';
import { createSuggestionPlugin } from '../plugins/suggestion-plugin';
import { createTokenFocusPlugin } from '../plugins/token-focus-plugin';

/**
 * Registers the plugins that own token focus, suggestion state and selection
 * guarding. The low priority keeps them behind every other extension's plugins,
 * so they see transactions and events last.
 */
export const CorePluginsExtension = Extension.create({
  name: 'corePlugins',

  priority: 1,

  addProseMirrorPlugins() {
    return [createTokenFocusPlugin(), createSuggestionPlugin(), createSelectionGuardPlugin()];
  },
});
