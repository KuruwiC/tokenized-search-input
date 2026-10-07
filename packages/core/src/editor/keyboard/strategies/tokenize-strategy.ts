import { isSuggestionOpen } from '../../../plugins/suggestion';
import { tryAutoTokenize } from '../../auto-tokenize';
import { canAutoTokenize } from '../guards';
import type { KeyboardContext } from '../types';

/**
 * Handle Tab key for auto-tokenization.
 * Similar to space but only when suggestions are closed.
 */
export function handleTab(ctx: KeyboardContext): boolean {
  if (!canAutoTokenize(ctx.editor)) {
    return false;
  }

  // Tab should not interfere with suggestion navigation
  if (isSuggestionOpen(ctx.suggestionState)) {
    return false;
  }

  return tryAutoTokenize(ctx.editor, 'Tab');
}

/**
 * Handle Enter key for auto-tokenization (without search execution).
 * Called before search handler to tokenize pending text.
 */
export function handleEnterTokenize(ctx: KeyboardContext): boolean {
  if (!canAutoTokenize(ctx.editor)) {
    return false;
  }

  return tryAutoTokenize(ctx.editor, 'Enter');
}
