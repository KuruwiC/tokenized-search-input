/**
 * DOM focus detection utilities for token-based search input.
 *
 * Provides predicate functions and selectors for determining
 * focus state relative to tokens and suggestion UI.
 */

/** Data attribute selectors for focus detection */
export const FOCUS_SELECTORS = {
  filterToken: '[data-filter-token]',
  suggestionRoot: '[data-suggestion-root]',
  focusedFilterToken: '[data-filter-token][data-focused="true"]',
  valueInput: 'input[data-token-block="value"]',
} as const;

export const isWithinSuggestion = (el: Element | null): boolean =>
  el?.closest(FOCUS_SELECTORS.suggestionRoot) != null;

export const findFocusedFilterToken = (container: Element | null): HTMLElement | null => {
  const el = container?.querySelector(FOCUS_SELECTORS.focusedFilterToken);
  return el instanceof HTMLElement ? el : null;
};

export const getContainingFilterToken = (el: Element | null): HTMLElement | null => {
  const token = el?.closest(FOCUS_SELECTORS.filterToken);
  return token instanceof HTMLElement ? token : null;
};

export const findValueInput = (token: Element | null): HTMLInputElement | null => {
  const el = token?.querySelector(FOCUS_SELECTORS.valueInput);
  return el instanceof HTMLInputElement ? el : null;
};
