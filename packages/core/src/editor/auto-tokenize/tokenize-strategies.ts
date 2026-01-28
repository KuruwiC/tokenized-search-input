/**
 * Tokenize Strategies for Auto-Tokenize Hook.
 *
 * Implements Strategy Pattern to handle different tokenization scenarios:
 * - Bulk insertion (paste/programmatic)
 * - Single character typing
 */
import type { FreeTextMode } from '../../types';
import type { TokenizeEvent, TokenizeOptions, TokenizeStrategy } from './types';

const DEBOUNCE_MS = 50;

/** Strategy for bulk insertion (paste or programmatic insertion). */
export const bulkInsertStrategy: TokenizeStrategy = {
  shouldTokenize(event: TokenizeEvent): boolean {
    if (event.isHistoryOperation) return false;
    // Bulk insertion: more than 1 character added at once
    return event.sizeChange > 1;
  },

  getOptions(freeTextMode: FreeTextMode): TokenizeOptions {
    return {
      forceCursorText: true,
      freeTextMode,
    };
  },

  shouldTriggerValidation(): boolean {
    return true;
  },

  debounceMs: null,
};

/** Strategy for single character typing in tokenize mode. */
export const singleCharStrategy: TokenizeStrategy = {
  shouldTokenize(event: TokenizeEvent, freeTextMode: FreeTextMode): boolean {
    if (event.isHistoryOperation) return false;
    // Only tokenize in 'tokenize' mode
    if (freeTextMode !== 'tokenize') return false;
    // Not bulk insertion
    return event.sizeChange <= 1;
  },

  getOptions(freeTextMode: FreeTextMode): TokenizeOptions {
    return {
      forceCursorText: false,
      freeTextMode,
    };
  },

  shouldTriggerValidation(): boolean {
    return false;
  },

  debounceMs: DEBOUNCE_MS,
};

export function getStrategy(event: TokenizeEvent): TokenizeStrategy | null {
  // Check bulk insert first (higher priority)
  if (bulkInsertStrategy.shouldTokenize(event, 'tokenize')) {
    return bulkInsertStrategy;
  }
  // Then check single char (only in tokenize mode, checked in strategy)
  return singleCharStrategy;
}

export function createInitialState(initialDocSize: number = 0): {
  lastDocSize: number;
  pendingDebounce: ReturnType<typeof setTimeout> | null;
  isHistoryOperation: boolean;
} {
  return {
    lastDocSize: initialDocSize,
    pendingDebounce: null,
    isHistoryOperation: false,
  };
}
