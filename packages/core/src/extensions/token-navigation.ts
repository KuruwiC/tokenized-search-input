import { Extension } from '@tiptap/core';

/**
 * Extension for token navigation keyboard shortcuts.
 * ArrowLeft/Right/Backspace/Delete are handled by the selection guard plugin.
 *
 * Note: This extension explicitly handles Mod-a so that selectAll covers the tokens as
 * well. Without this, the default browser behavior may not select the non-editable
 * token elements.
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
