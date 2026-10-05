/**
 * DOM focus detection utilities for token-based search input.
 *
 * Provides predicate and lookup functions for determining
 * focus state relative to tokens and suggestion UI.
 */

/** Data attribute selectors for focus detection */
const FOCUS_SELECTORS = {
  suggestionRoot: '[data-suggestion-root]',
  valueInput: 'input[data-token-block="value"]',
} as const;

export const isWithinSuggestion = (el: Element | null): boolean =>
  el?.closest(FOCUS_SELECTORS.suggestionRoot) != null;

export const findValueInput = (token: Element | null): HTMLInputElement | null => {
  const el = token?.querySelector(FOCUS_SELECTORS.valueInput);
  return el instanceof HTMLInputElement ? el : null;
};
