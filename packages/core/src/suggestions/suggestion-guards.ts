/**
 * Suggestion Guard Functions
 *
 * Common guard conditions for controlling when suggestions should be shown.
 * These functions centralize the logic that was previously duplicated across multiple hooks.
 */

import type { EditorState } from '@tiptap/pm/state';
import { getSuggestionState } from '../plugins/suggestion-plugin';
import { getTokenFocusState } from '../plugins/token-focus-plugin';

/**
 * Check if field suggestions can be shown.
 *
 * Field suggestions are only valid when:
 * - Field suggestions are not disabled
 * - No token is currently focused
 * - Not already showing value/date/datetime suggestions
 */
export function canShowFieldSuggestion(state: EditorState): boolean {
  const suggestionState = getSuggestionState(state);
  const tokenFocusState = getTokenFocusState(state);

  // Field suggestions must not be disabled
  if (suggestionState?.fieldSuggestionsDisabled) return false;

  // Cannot show when a token is focused
  if (tokenFocusState?.focusedPos != null) return false;

  // Cannot show when value/date/datetime suggestion is active
  const currentType = suggestionState?.type;
  if (currentType === 'value' || currentType === 'date' || currentType === 'datetime') {
    return false;
  }

  return true;
}

/**
 * Check if value suggestions can be shown.
 *
 * Value suggestions are only valid when:
 * - Value suggestions are not disabled
 * - A token is currently focused
 * - Not already showing field suggestions
 */
export function canShowValueSuggestion(state: EditorState): boolean {
  const suggestionState = getSuggestionState(state);
  const tokenFocusState = getTokenFocusState(state);

  // Value suggestions must not be disabled
  if (suggestionState?.valueSuggestionsDisabled) return false;

  // Must have a focused token
  if (tokenFocusState?.focusedPos == null) return false;

  // Cannot show when field suggestion is active
  const currentType = suggestionState?.type;
  if (currentType === 'field' || currentType === 'custom' || currentType === 'fieldWithCustom') {
    return false;
  }

  return true;
}

/**
 * Check if custom suggestions can be shown.
 *
 * Custom suggestions are only valid when:
 * - No token is currently focused
 * - Not already showing value/date/datetime suggestions
 *
 * Note: Custom suggestions work independently of fieldSuggestionsDisabled
 */
export function canShowCustomSuggestion(state: EditorState): boolean {
  const suggestionState = getSuggestionState(state);
  const tokenFocusState = getTokenFocusState(state);

  // Cannot show when a token is focused
  if (tokenFocusState?.focusedPos != null) return false;

  // Cannot show when value/date/datetime suggestion is active
  const currentType = suggestionState?.type;
  if (currentType === 'value' || currentType === 'date' || currentType === 'datetime') {
    return false;
  }

  return true;
}

/**
 * Check if within an editable area (not a date/datetime picker).
 *
 * Returns true when:
 * - No suggestion is open, or
 * - A field/value/custom suggestion is open (but not date/datetime)
 */
export function isWithinEditableArea(state: EditorState): boolean {
  const suggestionState = getSuggestionState(state);

  if (!suggestionState?.type) return true;

  // Date/datetime pickers are not editable text areas
  if (suggestionState.type === 'date' || suggestionState.type === 'datetime') {
    return false;
  }

  return true;
}

/**
 * Check if a suggestion is currently open and active.
 */
export function isSuggestionActive(state: EditorState): boolean {
  const suggestionState = getSuggestionState(state);
  return suggestionState?.type != null;
}

/**
 * Check if the suggestion is dismissed.
 */
export function isSuggestionDismissed(state: EditorState): boolean {
  const suggestionState = getSuggestionState(state);
  return suggestionState?.dismissed ?? false;
}

/**
 * Get the current suggestion type, if any.
 */
export function getCurrentSuggestionType(
  state: EditorState
): 'field' | 'value' | 'custom' | 'fieldWithCustom' | 'date' | 'datetime' | null {
  const suggestionState = getSuggestionState(state);
  return suggestionState?.type ?? null;
}
