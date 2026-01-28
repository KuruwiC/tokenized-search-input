/**
 * Range Merger
 *
 * Handles merging of overlapping deletion ranges.
 * Extracted from validation/plan-executor.ts for reuse.
 */
import type { MergeableRange } from './types';

/**
 * Merge overlapping ranges into a consolidated list.
 * Ranges must be sorted by 'from' position before calling.
 *
 * @param ranges - Sorted array of ranges to merge
 * @returns New array with overlapping ranges merged
 */
export function mergeOverlappingRanges<T extends MergeableRange>(ranges: T[]): T[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged: T[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.from <= last.to) {
      last.to = Math.max(last.to, range.to);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}
