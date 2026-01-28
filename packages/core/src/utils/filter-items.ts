import type { Matcher } from '../types';
import { defaultMatcher, matchBest } from './matcher';

export interface FilterItemsOptions {
  /**
   * Matcher function to use for filtering.
   * @default matchers.fuzzy
   */
  matcher?: Matcher;
  /**
   * Minimum score threshold for inclusion.
   * @default 1
   */
  minScore?: number;
}

/**
 * Filter items by query string using the specified matcher.
 * Results are sorted by match score (highest first).
 *
 * @param items - Array of items to filter
 * @param query - Search query string
 * @param getTargets - Function to extract match targets from each item
 * @param options - Filter options
 *
 * @example
 * // Filter fields by key and label
 * const filtered = filterItems(
 *   fields,
 *   'stat',
 *   (f) => [f.key, f.label],
 * );
 *
 * @example
 * // Filter enum values
 * const filtered = filterItems(
 *   enumValues,
 *   'act',
 *   (ev) => [getEnumValue(ev), getEnumLabel(ev)],
 * );
 */
export function filterItems<T>(
  items: readonly T[],
  query: string,
  getTargets: (item: T) => string[],
  options?: FilterItemsOptions
): T[] {
  if (!items || items.length === 0) return [];

  if (!query?.trim()) {
    return [...items];
  }

  const matcher = options?.matcher ?? defaultMatcher;
  const minScore = options?.minScore ?? 1;

  const scored = items
    .map((item) => ({
      item,
      score: matchBest(matcher, query, ...getTargets(item)),
    }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ item }) => item);
}
