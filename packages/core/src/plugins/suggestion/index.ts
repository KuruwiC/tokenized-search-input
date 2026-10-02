/**
 * Suggestion Plugin
 *
 * Re-exports for the suggestion plugin module.
 */

// Actions
export {
  appendCustomSuggestions,
  clearDismissed,
  closeSuggestion,
  dismissSuggestion,
  isSuggestionOpen,
  navigateSuggestion,
  openCustomSuggestion,
  openDateSuggestion,
  openDateTimeSuggestion,
  openFieldSuggestion,
  openFieldWithCustomSuggestion,
  openValueSuggestion,
  setCustomLoadingMore,
  setSuggestion,
  setSuggestionLoading,
  updateSuggestionActiveIndex,
  updateSuggestionDateValue,
  updateSuggestionTimeControls,
} from './actions';
// Anchors
export { isAnchoredToToken, resolveAnchorPos } from './anchor';
// Plugin
export {
  createSuggestionPlugin,
  getSuggestionState,
  type SuggestionPluginOptions,
  suggestionKey,
} from './plugin';
// State helpers
export { createResetState, type ResetStateOptions } from './state-helpers';
// Types
export type {
  CloseSuggestionMeta,
  CustomDisplayMode,
  CustomPagination,
  SetSuggestionMeta,
  SuggestionAnchor,
  SuggestionMeta,
  SuggestionState,
  SuggestionType,
} from './types';
export { initialSuggestionState } from './types';
// Value suggestions
export { getEditableValueText, matchValueSuggestions } from './value-items';
