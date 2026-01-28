import type { CustomSuggestion, CustomSuggestionSelectContext } from '../types';

export interface ToggleSelectOptions {
  /**
   * How to identify matching tokens.
   * - 'key-value': Match by both key and value (default)
   * - 'value': Match by value only (for single-field scenarios)
   */
  match?: 'key-value' | 'value';
}

/**
 * Creates a toggle selection handler for CustomSuggestionConfig.onSelect.
 * When a suggestion is selected that already exists, it removes the existing token.
 *
 * @example
 * ```typescript
 * const customSuggestion: CustomSuggestionConfig = {
 *   suggest: ({ query }) => fetchSuggestions(query),
 *   onSelect: createToggleSelectHandler(),
 * };
 * ```
 */
export function createToggleSelectHandler(
  options?: ToggleSelectOptions
): (suggestion: CustomSuggestion, context: CustomSuggestionSelectContext) => boolean {
  const matchMode = options?.match ?? 'key-value';

  return (suggestion, { existingTokens, deleteToken }) => {
    const token = suggestion.tokens[0];
    if (!token) return false;

    const existing = existingTokens.find((t) => {
      if (matchMode === 'value') {
        return t.value === token.value;
      }
      return t.key === token.key && t.value === token.value;
    });

    if (existing) {
      deleteToken(existing.id);
      return true;
    }

    return false;
  };
}
