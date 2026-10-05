import type { Editor } from '@tiptap/core';
import { getFocusedToken } from '../../plugins/token-focus';
import type { FreeTextMode } from '../../types';

// Uses ProseMirror plugin state instead of DOM queries for reliability.
export function isTokenFocused(editor: Editor): boolean {
  return getFocusedToken(editor.state) !== null;
}

export function isTokenizeMode(mode: FreeTextMode): boolean {
  return mode === 'tokenize';
}

/**
 * Check if we should handle auto-tokenization.
 * Auto-tokenization should not occur when inside a token.
 */
export function canAutoTokenize(editor: Editor): boolean {
  return !isTokenFocused(editor);
}
