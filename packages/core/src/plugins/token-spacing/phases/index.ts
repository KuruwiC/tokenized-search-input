import type { DocumentRepairPhase } from '../types';
import { adjacentTextRepairPhase } from './adjacent-text-repair';
import { emptyTokenCleanupPhase } from './empty-token-cleanup';
import { historyEmptyTokenFocusPhase } from './history-empty-token-focus';
import { missingSpacerRepairPhase } from './missing-spacer-repair';
import { orphanedSpacerCleanupPhase } from './orphaned-spacer-cleanup';

/**
 * Document repair phases in execution order.
 *
 * Order matters:
 * 0. History empty token focus - must run FIRST to focus restored empty tokens
 *    (before cleanup phases try to process them)
 * 1. Empty token cleanup - removes empty tokens when focus moves away
 * 2. Orphaned spacer cleanup - cleans up spacers left behind
 * 3. Missing spacer repair - ensures all tokens have spacers
 * 4. Adjacent text repair - ensures proper text separation
 */
export const documentRepairPhases: DocumentRepairPhase[] = [
  historyEmptyTokenFocusPhase,
  emptyTokenCleanupPhase,
  orphanedSpacerCleanupPhase,
  missingSpacerRepairPhase,
  adjacentTextRepairPhase,
];

export {
  historyEmptyTokenFocusPhase,
  emptyTokenCleanupPhase,
  orphanedSpacerCleanupPhase,
  missingSpacerRepairPhase,
  adjacentTextRepairPhase,
};
