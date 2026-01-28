/**
 * Spacer Domain Types
 *
 * Core type definitions for spacer operations.
 * These types are used by multiple plugins (validation, token-spacing, selection-guard).
 */

/**
 * Range for deletion with spacer expansion.
 */
export interface SpacerExpandedRange {
  from: number;
  to: number;
  needsSpaceSeparator: boolean;
}

/**
 * Range that can be merged with other ranges.
 * Used for consolidating overlapping deletion ranges.
 */
export interface MergeableRange {
  from: number;
  to: number;
  needsSpaceSeparator?: boolean;
}
