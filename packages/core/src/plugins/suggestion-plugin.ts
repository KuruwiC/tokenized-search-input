/**
 * Suggestion Plugin
 *
 * Re-exports from the modular suggestion plugin implementation.
 * This file maintains backward compatibility for existing imports.
 */

// Types
export type {
  CloseSuggestionMeta,
  CustomDisplayMode,
  SetSuggestionMeta,
  SuggestionAnchor,
  SuggestionMeta,
  SuggestionPluginOptions,
  SuggestionState,
  SuggestionType,
} from './suggestion';
// Plugin
// Actions
export {
  clearDismissed,
  closeSuggestion,
  createSuggestionPlugin,
  dismissSuggestion,
  getEditableValueText,
  getSuggestionState,
  initialSuggestionState,
  isAnchoredToToken,
  isSuggestionOpen,
  matchValueSuggestions,
  navigateSuggestion,
  openCustomSuggestion,
  openDateSuggestion,
  openDateTimeSuggestion,
  openFieldSuggestion,
  openFieldWithCustomSuggestion,
  openValueSuggestion,
  resolveAnchorPos,
  setSuggestion,
  setSuggestionLoading,
  suggestionKey,
  updateSuggestionActiveIndex,
  updateSuggestionDateValue,
} from './suggestion';
