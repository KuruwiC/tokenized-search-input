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
  getSuggestionState,
  initialSuggestionState,
  isAnchoredToToken,
  isSuggestionOpen,
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
