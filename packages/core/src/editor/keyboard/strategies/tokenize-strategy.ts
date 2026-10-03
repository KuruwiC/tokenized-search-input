import { closeSuggestion } from '../../../plugins/suggestion';
import { getTextBeforeCursor, tryAutoTokenize } from '../../use-auto-tokenize';
import { canAutoTokenize, isSuggestionOpen, isTokenizeMode } from '../guards';
import type { KeyboardContext } from '../types';

function closeSuggestionIfOpen(ctx: KeyboardContext): void {
  const { editor, suggestionState } = ctx;
  if (isSuggestionOpen(suggestionState)) {
    const tr = editor.state.tr;
    closeSuggestion(tr);
    editor.view.dispatch(tr);
  }
}

/**
 * Handle delimiter key for auto-tokenization.
 * "fieldKey{delimiter}" creates an empty filter token.
 */
export function handleDelimiter(ctx: KeyboardContext): boolean {
  if (!canAutoTokenize(ctx.editor)) {
    return false;
  }

  if (tryAutoTokenize(ctx.editor, ctx.delimiter)) {
    closeSuggestionIfOpen(ctx);
    return true;
  }

  return false;
}

/**
 * Handle space key for auto-tokenization: the word before the caret becomes a filter
 * token, or in tokenize mode a free text token.
 */
export function handleSpace(ctx: KeyboardContext): boolean {
  if (!canAutoTokenize(ctx.editor)) {
    return false;
  }

  if (tryAutoTokenize(ctx.editor, ' ')) {
    closeSuggestionIfOpen(ctx);
    return true;
  }

  return false;
}

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
 * Handle double quote key for quoted free text token.
 * Only in tokenize mode, at word boundary.
 */
export function handleQuote(ctx: KeyboardContext): boolean {
  if (!canAutoTokenize(ctx.editor)) {
    return false;
  }

  const { editor, freeTextMode } = ctx;

  if (!isTokenizeMode(freeTextMode)) {
    return false;
  }

  const textBefore = getTextBeforeCursor(editor);
  // Only trigger at word boundary (start, after space, or after token)
  if (textBefore && !textBefore.endsWith(' ') && !textBefore.endsWith('\ufffc')) {
    return false;
  }

  editor.commands.insertFreeTextToken({
    value: '',
    quoted: true,
    position: 'end',
  });

  closeSuggestionIfOpen(ctx);
  return true;
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
