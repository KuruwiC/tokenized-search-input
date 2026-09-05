import { Extension } from '@tiptap/core';

/**
 * Extension for token navigation keyboard shortcuts.
 * ArrowLeft/Right/Backspace/Delete are handled by token-spacing-plugin's rule engine.
 *
 * Note: This extension explicitly handles Mod-a to ensure selectAll works correctly
 * with the Spacer-based document structure. Without this, the default browser behavior
 * may not properly select all content including tokens.
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
