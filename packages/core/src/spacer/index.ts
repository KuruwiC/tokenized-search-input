/**
 * Spacer Domain Module
 *
 * Central module for all spacer-related operations.
 * This is a neutral package that can be consumed by any plugin
 * without creating circular dependencies.
 *
 * Consumers:
 * - validation/plan-executor.ts
 * - token-spacing/helpers
 * - selection-guard-plugin.ts
 */

// Boundary
export { checkBoundaryNeedsSpace } from './boundary-check';
// Deletion
export { applySpacerDeletion } from './deletion';
// Expansion
export { expandWithSpacers } from './expansion';
// Insertion
export { insertSpacer } from './insertion';
// Range operations
export { mergeOverlappingRanges } from './range-merger';
// Types
export type { MergeableRange, SpacerExpandedRange } from './types';
