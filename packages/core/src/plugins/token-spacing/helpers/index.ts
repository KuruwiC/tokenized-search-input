// Re-export spacer operations from the spacer domain module
export {
  applySpacerDeletion,
  checkBoundaryNeedsSpace,
  expandWithSpacers,
  insertSpacer,
  type SpacerExpandedRange,
} from '../../../spacer';

// Token-spacing specific helpers
export { expandSelectionForDeletion } from './selection-expansion';
export { findMissingSpacers, findOrphanedSpacers } from './spacer-analysis';
export { findAdjacentTextNodes } from './text-analysis';
export { getEmptyTokenAt, isEmptyToken } from './token-predicates';
