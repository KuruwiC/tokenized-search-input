import { initialSuggestionState, type SuggestionState } from './types';

export interface ResetStateOptions {
  /** Keep the current `dismissed` flag instead of clearing it (default: false). */
  preserveDismissed?: boolean;
}

/** The initial suggestion state, optionally keeping the current `dismissed` flag. */
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
