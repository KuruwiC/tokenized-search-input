import { closeSuggestion } from '../../../plugins/suggestion-plugin';
import { getCurrentWord, getTextBeforeCursor, tryAutoTokenize } from '../../use-auto-tokenize';
import { canAutoTokenize, isSuggestionOpen, isTokenizeMode } from '../guards';
import type { KeyboardContext } from '../types';

/**
 * Convert current word to freeTextToken.
 * Only applicable in tokenize mode.
 *
 * Note: insertFreeTextToken already adds spacer nodes: [spacer][token][spacer].
 */
function tokenizeCurrentWordAsFreeText(ctx: KeyboardContext): boolean {
  const { editor } = ctx;
  const { word, from, to } = getCurrentWord(editor);
  const trimmedWord = word.trim();
  if (!trimmedWord || from >= to) return false;

  editor
    .chain()
    .deleteRange({ from, to })
    .insertFreeTextToken({
      value: trimmedWord,
      quoted: false,
    })
    .run();

  return true;
}

function closeSuggestionIfOpen(ctx: KeyboardContext): void {
  const { editor, suggestionState } = ctx;
  if (isSuggestionOpen(suggestionState)) {
    const tr = editor.state.tr;
    closeSuggestion(tr);
    tr.setMeta('addToHistory', false);
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

  const { editor, fields, allowUnknownFields, unknownFieldOperators, delimiter } = ctx;

  if (
    tryAutoTokenize(editor, fields, delimiter, allowUnknownFields, unknownFieldOperators, delimiter)
  ) {
    closeSuggestionIfOpen(ctx);
    return true;
  }

  return false;
}

/**
 * Handle space key for auto-tokenization.
 * - First tries to create a filter token from "field{delimiter}op{delimiter}value"
 * - In tokenize mode, converts current word to freeTextToken
 */
export function handleSpace(ctx: KeyboardContext): boolean {
  if (!canAutoTokenize(ctx.editor)) {
    return false;
  }

  const { editor, fields, freeTextMode, allowUnknownFields, unknownFieldOperators, delimiter } =
    ctx;

  // Try filter token first
  if (tryAutoTokenize(editor, fields, ' ', allowUnknownFields, unknownFieldOperators, delimiter)) {
    closeSuggestionIfOpen(ctx);
    return true;
  }

  // In tokenize mode, convert current word to freeTextToken
  if (isTokenizeMode(freeTextMode)) {
    if (tokenizeCurrentWordAsFreeText(ctx)) {
      closeSuggestionIfOpen(ctx);
      return true;
    }
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

  const { editor, fields, freeTextMode, allowUnknownFields, unknownFieldOperators, delimiter } =
    ctx;

  if (
    tryAutoTokenize(editor, fields, 'Tab', allowUnknownFields, unknownFieldOperators, delimiter)
  ) {
    return true;
  }

  if (isTokenizeMode(freeTextMode)) {
    if (tokenizeCurrentWordAsFreeText(ctx)) {
      return true;
    }
  }

  return false;
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
    cursorPosition: 'end',
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

  const { editor, fields, allowUnknownFields, unknownFieldOperators, delimiter } = ctx;

  // Try to create filter token
  if (
    tryAutoTokenize(editor, fields, 'Enter', allowUnknownFields, unknownFieldOperators, delimiter)
  ) {
    return true;
  }

  return false;
}
