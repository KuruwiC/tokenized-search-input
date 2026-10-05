import type { Editor } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { getEditorContext } from '../extensions/editor-context';
import { getSuggestionState, isTokenSuggestionType } from '../plugins/suggestion';
import { getFocusedToken } from '../plugins/token-focus';

/**
 * Field suggestions need the feature enabled, no focused token, and no value, date or
 * datetime suggestion showing.
 */
export function canShowFieldSuggestion(editor: Editor): boolean {
  const { state } = editor;
  const suggestionState = getSuggestionState(state);

  if (getEditorContext(editor).fieldSuggestionsDisabled) return false;

  if (getFocusedToken(state) !== null) return false;

  if (isTokenSuggestionType(suggestionState?.type ?? null)) return false;

  return true;
}

/**
 * Value suggestions need the feature enabled, a focused token, and no field, custom or
 * fieldWithCustom suggestion showing.
 */
export function canShowValueSuggestion(editor: Editor): boolean {
  const { state } = editor;
  const suggestionState = getSuggestionState(state);

  if (getEditorContext(editor).valueSuggestionsDisabled) return false;

  if (getFocusedToken(state) === null) return false;

  const currentType = suggestionState?.type ?? null;
  if (currentType !== null && !isTokenSuggestionType(currentType)) return false;

  return true;
}

/**
 * Custom suggestions need no focused token and no value, date or datetime suggestion
 * showing. `fieldSuggestionsDisabled` does not affect them.
 */
export function canShowCustomSuggestion(state: EditorState): boolean {
  const suggestionState = getSuggestionState(state);

  if (getFocusedToken(state) !== null) return false;

  if (isTokenSuggestionType(suggestionState?.type ?? null)) return false;

  return true;
}

export function isSuggestionDismissed(state: EditorState): boolean {
  const suggestionState = getSuggestionState(state);
  return suggestionState?.dismissed ?? false;
}

export function getCurrentSuggestionType(
  state: EditorState
): 'field' | 'value' | 'custom' | 'fieldWithCustom' | 'date' | 'datetime' | null {
  const suggestionState = getSuggestionState(state);
  return suggestionState?.type ?? null;
}
