import { Extension } from '@tiptap/core';

/**
 * Handles Mod-a explicitly so that selectAll covers the tokens too; the browser's
 * default may skip the non-editable token elements. ArrowLeft/Right, Backspace and
 * Delete are handled by the selection guard plugin.
 */
export const TokenNavigation = Extension.create({
  name: 'tokenNavigation',

  addKeyboardShortcuts() {
    return {
      'Mod-a': ({ editor }) => {
        editor.commands.selectAll();
        return true;
      },
    };
  },
});
