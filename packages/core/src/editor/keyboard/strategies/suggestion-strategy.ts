import {
  closeSuggestion,
  navigateSuggestion,
  suggestionEntries,
} from '../../../plugins/suggestion';
import { isSuggestionOpen, isTokenFocused } from '../guards';
import type { KeyboardCallbacks, KeyboardContext } from '../types';

export function handleArrowDown(ctx: KeyboardContext): boolean {
  const { editor, suggestionState } = ctx;

  // isSuggestionOpen already checks for null/undefined
  if (!isSuggestionOpen(suggestionState)) {
    return false;
  }

  const tr = editor.state.tr;
  navigateSuggestion(tr, suggestionState, 'down');
  editor.view.dispatch(tr);
  return true;
}

export function handleArrowUp(ctx: KeyboardContext): boolean {
  const { editor, suggestionState } = ctx;

  // isSuggestionOpen already checks for null/undefined
  if (!isSuggestionOpen(suggestionState)) {
    return false;
  }

  const tr = editor.state.tr;
  navigateSuggestion(tr, suggestionState, 'up');
  editor.view.dispatch(tr);
  return true;
}

/**
 * Handle Enter key for suggestion selection.
 * - If an entry is active (activeIndex >= 0), select it
 * - If none is active (activeIndex === -1), close suggestions without selecting
 * Returns true if handled, false otherwise.
 */
export function handleEnterOnSuggestion(
  ctx: KeyboardContext,
  callbacks: KeyboardCallbacks
): boolean {
  const { editor, suggestionState } = ctx;

  // isSuggestionOpen already checks for null/undefined
  if (!isSuggestionOpen(suggestionState)) {
    return false;
  }

  const entry = suggestionEntries(suggestionState)[suggestionState.activeIndex];
  if (entry?.kind === 'field') {
    callbacks.onFieldSelect(entry.field);
    return true;
  }
  if (entry?.kind === 'custom') {
    callbacks.onCustomSelect(entry.suggestion);
    return true;
  }

  // This provides predictable UX: first Enter closes, second Enter triggers search
  const tr = editor.state.tr;
  closeSuggestion(tr);
  editor.view.dispatch(tr);
  return true;
}

/**
 * Handle Escape key to close suggestions.
 * When a token is focused, ESC handling is delegated to Token.handleKeyDown
 * which implements 2-stage behavior (1st closes suggestions, 2nd exits token).
 */
export function handleEscape(ctx: KeyboardContext): boolean {
  const { editor, suggestionState } = ctx;

  // Delegate to Token when focused (Token implements 2-stage ESC behavior)
  if (isTokenFocused(editor)) {
    return false;
  }

  if (!isSuggestionOpen(suggestionState)) {
    return false;
  }

  const tr = editor.state.tr;
  closeSuggestion(tr);
  editor.view.dispatch(tr);
  return true;
}
