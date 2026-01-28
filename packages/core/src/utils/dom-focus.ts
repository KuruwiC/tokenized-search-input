/**
 * DOM focus detection utilities for token-based search input.
 *
 * Provides predicate functions and selectors for determining
 * focus state relative to tokens and suggestion UI.
 */

/** Data attribute selectors for focus detection */
export const FOCUS_SELECTORS = {
  filterToken: '[data-filter-token]',
  freeTextToken: '[data-free-text-token]',
  anyToken: '[data-filter-token], [data-free-text-token]',
  suggestionRoot: '[data-suggestion-root]',
  focusedFilterToken: '[data-filter-token][data-focused="true"]',
} as const;

export const isWithinToken = (el: Element | null): boolean =>
  el?.closest(FOCUS_SELECTORS.anyToken) != null;

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
