import type { JSONContent } from '@tiptap/core';
import type { FreeTextMode } from '../../types';
import { escapeForQuotes } from '../../utils/quoted-string';
import { generateTokenId } from '../../utils/token-id';

/**
 * Parsed free text token with additional metadata.
 */
export interface ParsedFreeTextToken {
  type: 'freeText';
  value: string;
  quoted: boolean;
  /** Original raw text as it appeared in input (includes quotes and escapes) */
  rawText?: string;
}

/**
 * Finalize action to take before commit (submit/blur).
 * - 'tokenize': Convert pending text to freeTextToken
 * - 'remove': Remove all text nodes from document
 * - 'none': No action needed
 */
export type FinalizeAction = 'tokenize' | 'remove' | 'none';

/**
 * Strategy interface for handling free text tokens based on mode.
 */
export interface FreeTextStrategy {
  /**
   * Convert a parsed free text token to JSONContent for document insertion.
   * Returns null if the token should be skipped (e.g., none mode).
   */
  toDocContent: (token: ParsedFreeTextToken) => JSONContent | null;

  /**
   * Whether to tokenize text on space/tab input.
   */
  tokenizeOnSpace: boolean;

  /**
   * Whether to create quoted tokens when " is pressed.
   */
  createQuotedTokens: boolean;

  /**
   * Action to take when finalizing input (submit/blur).
   */
  finalizeAction: FinalizeAction;
}

/**
 * Tokenize mode: free text becomes freeTextToken nodes.
 */
const tokenizeStrategy: FreeTextStrategy = {
  toDocContent: (token) => ({
    type: 'freeTextToken',
    attrs: {
      id: generateTokenId(),
      value: token.value,
      quoted: token.quoted,
    },
  }),
  tokenizeOnSpace: true,
  createQuotedTokens: true,
  finalizeAction: 'tokenize',
};

/**
 * Plain mode: free text becomes regular text nodes (preserving quotes in display).
 */
const plainStrategy: FreeTextStrategy = {
  toDocContent: (token) => ({
    type: 'text',
    text: token.quoted ? `"${escapeForQuotes(token.value)}"` : token.value,
  }),
  tokenizeOnSpace: false,
  createQuotedTokens: false,
  finalizeAction: 'none',
};

/**
 * None mode: free text is ignored entirely.
 */
const noneStrategy: FreeTextStrategy = {
  toDocContent: () => null,
  tokenizeOnSpace: false,
  createQuotedTokens: false,
  finalizeAction: 'remove',
};

/**
 * Map of FreeTextMode to corresponding strategy.
 */
export const freeTextStrategies: Record<FreeTextMode, FreeTextStrategy> = {
  tokenize: tokenizeStrategy,
  plain: plainStrategy,
  none: noneStrategy,
};

/**
 * Get the strategy for a given FreeTextMode.
 */
export function getFreeTextStrategy(mode: FreeTextMode): FreeTextStrategy {
  return freeTextStrategies[mode];
}
