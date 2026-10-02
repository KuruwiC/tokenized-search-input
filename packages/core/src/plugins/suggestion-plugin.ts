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
  CustomPagination,
  SetSuggestionMeta,
  SuggestionAnchor,
  SuggestionEntry,
  SuggestionMeta,
  SuggestionPluginOptions,
  SuggestionState,
  SuggestionType,
} from './suggestion';
// Plugin
// Actions
export {
  appendCustomSuggestions,
  clearDismissed,
  closeSuggestion,
  createSuggestionPlugin,
  DEFAULT_CATEGORY,
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
  setCustomLoadingMore,
  setSuggestion,
  setSuggestionLoading,
  suggestionEntries,
  suggestionKey,
  updateSuggestionActiveIndex,
  updateSuggestionDateValue,
  updateSuggestionTimeControls,
} from './suggestion';
