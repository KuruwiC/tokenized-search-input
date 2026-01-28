/**
 * Suggestion State Helpers
 *
 * Helper functions for managing suggestion plugin state transitions.
 */
import { initialSuggestionState, type SuggestionState } from './types';

/**
 * Options for creating a reset state.
 */
export interface ResetStateOptions {
  /**
   * Whether to preserve the disabled flags from the current state.
   * When true, fieldSuggestionsDisabled and valueSuggestionsDisabled are preserved.
   * @default true
   */
  preserveDisabled?: boolean;

  /**
   * Whether to preserve the dismissed flag from the current state.
   * When true, dismissed is preserved from the current state.
   * When false, dismissed is reset to false.
   * @default false
   */
  preserveDismissed?: boolean;
}

/**
 * Create a reset state from the current state, preserving specified fields.
 *
 * This function provides a centralized way to reset suggestion state while
 * preserving certain fields that should persist across resets (like disabled flags).
 *
 * @param currentState - The current suggestion state
 * @param options - Configuration for what to preserve
 * @returns A new reset state with specified fields preserved
 *
 * @example
 * // Reset state, preserving disabled flags
 * return createResetState(value);
 *
 * @example
 * // Reset state, preserving both disabled flags and dismissed
 * return createResetState(value, { preserveDismissed: true });
 */
export function createResetState(
  currentState: SuggestionState,
  options: ResetStateOptions = {}
): SuggestionState {
  const { preserveDisabled = true, preserveDismissed = false } = options;

  return {
    ...initialSuggestionState,
    fieldSuggestionsDisabled: preserveDisabled
      ? currentState.fieldSuggestionsDisabled
      : initialSuggestionState.fieldSuggestionsDisabled,
    valueSuggestionsDisabled: preserveDisabled
      ? currentState.valueSuggestionsDisabled
      : initialSuggestionState.valueSuggestionsDisabled,
    dismissed: preserveDismissed ? currentState.dismissed : false,
  };
}
