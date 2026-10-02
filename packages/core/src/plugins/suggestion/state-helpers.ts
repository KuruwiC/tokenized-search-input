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
 * @param currentState - The current suggestion state
 * @param options - Configuration for what to preserve
 * @returns A new reset state with specified fields preserved
 *
 * @example
 * return createResetState(value);
 *
 * @example
 * // Reset state, preserving dismissed
 * return createResetState(value, { preserveDismissed: true });
 */
export function createResetState(
  currentState: SuggestionState,
  options: ResetStateOptions = {}
): SuggestionState {
  const { preserveDismissed = false } = options;

  return {
    ...initialSuggestionState,
    dismissed: preserveDismissed ? currentState.dismissed : false,
  };
}
