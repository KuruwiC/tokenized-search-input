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
  isSuggestionOpen,
  navigateSuggestion,
  openCustomSuggestion,
  openDateSuggestion,
  openDateTimeSuggestion,
  openFieldSuggestion,
  openFieldWithCustomSuggestion,
  openValueSuggestion,
  setSuggestion,
  setSuggestionLoading,
  suggestionKey,
  updateSuggestionActiveIndex,
  updateSuggestionDateValue,
  updateSuggestionQuery,
} from './suggestion';
