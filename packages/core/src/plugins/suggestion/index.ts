/**
 * Suggestion Plugin
 *
 * Re-exports for the suggestion plugin module.
 */

// Actions
export {
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
  setSuggestion,
  setSuggestionLoading,
  updateSuggestionActiveIndex,
  updateSuggestionDateValue,
  updateSuggestionQuery,
} from './actions';
// Plugin
export { createSuggestionPlugin, getSuggestionState, suggestionKey } from './plugin';
// State helpers
export { createResetState, type ResetStateOptions } from './state-helpers';
// Types
export type {
  CloseSuggestionMeta,
  CustomDisplayMode,
  SetSuggestionMeta,
  SuggestionMeta,
  SuggestionState,
  SuggestionType,
} from './types';
export { initialSuggestionState } from './types';
