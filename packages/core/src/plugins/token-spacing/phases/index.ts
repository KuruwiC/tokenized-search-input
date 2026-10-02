import type { DocumentRepairPhase } from '../types';
import { emptyTokenCleanupPhase } from './empty-token-cleanup';
import { historyEmptyTokenFocusPhase } from './history-empty-token-focus';
import { wordBoundaryPhase } from './word-boundary';

/**
 * Document repair phases in execution order.
 *
 * Order matters:
 * 0. History empty token focus - must run FIRST to focus restored empty tokens
 *    (before cleanup phases try to process them)
 * 1. Empty token cleanup - removes empty tokens when focus moves away
 * 2. Word boundary - keeps apart the words a removed token separated, including
 *    the ones the cleanup above just brought together
 */
export const documentRepairPhases: DocumentRepairPhase[] = [
  historyEmptyTokenFocusPhase,
  emptyTokenCleanupPhase,
  wordBoundaryPhase,
];

export { historyEmptyTokenFocusPhase, emptyTokenCleanupPhase, wordBoundaryPhase };
