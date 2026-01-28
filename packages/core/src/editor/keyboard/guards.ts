import type { Editor } from '@tiptap/core';
import { getTokenFocusState } from '../../plugins/token-focus-plugin';
import type { FreeTextMode } from '../../types';

export { isSuggestionOpen } from '../../plugins/suggestion-plugin';

// Uses ProseMirror plugin state instead of DOM queries for reliability.
export function isTokenFocused(editor: Editor): boolean {
  const focusState = getTokenFocusState(editor.state);
  // focusedPos is number | null, so != null covers both null and undefined from optional chaining
  return focusState?.focusedPos != null;
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
