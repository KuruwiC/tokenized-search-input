import type { JSONContent } from '@tiptap/core';
import { quote } from '../../serializer/quoted-string';
import type { FreeTextMode } from '../../types';
import { generateTokenId } from '../../utils/token-id';

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
type FinalizeAction = 'tokenize' | 'remove' | 'none';

export interface FreeTextStrategy {
  /**
   * Convert a parsed free text token to JSONContent for document insertion.
   * Returns null if the token should be skipped (e.g., none mode).
   */
  toDocContent: (token: ParsedFreeTextToken) => JSONContent | null;

  finalizeAction: FinalizeAction;
}

const tokenizeStrategy: FreeTextStrategy = {
  toDocContent: (token) => ({
    type: 'freeTextToken',
    attrs: {
      id: generateTokenId(),
      value: token.value,
      quoted: token.quoted,
    },
  }),
  finalizeAction: 'tokenize',
};

const plainStrategy: FreeTextStrategy = {
  toDocContent: (token) => ({
    type: 'text',
    text: token.quoted ? quote(token.value, { always: true }) : token.value,
  }),
  finalizeAction: 'none',
};

const noneStrategy: FreeTextStrategy = {
  toDocContent: () => null,
  finalizeAction: 'remove',
};

export const freeTextStrategies: Record<FreeTextMode, FreeTextStrategy> = {
  tokenize: tokenizeStrategy,
  plain: plainStrategy,
  none: noneStrategy,
};

export function getFreeTextStrategy(mode: FreeTextMode): FreeTextStrategy {
  return freeTextStrategies[mode];
}
