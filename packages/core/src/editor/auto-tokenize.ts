import type { Editor } from '@tiptap/core';
import { getEditorContext, getFocusContext } from '../extensions/editor-context';
import { tokenizeRange } from '../plugins/auto-tokenize/tokenize-range';
import { markAutoTokenized, withoutHistory } from '../plugins/shared/meta';
import { findLastWordBoundary, isInsideQuotes, TOKEN_BOUNDARY } from '../serializer/quote-state';
import type { FieldDefinition } from '../types';
import { resolveField } from '../utils/resolve-field';
import { generateTokenId } from '../utils/token-id';

/** The paragraph text before the caret, each token read as `TOKEN_BOUNDARY`. */
function getTextBeforeCursor(editor: Editor): string {
  const { $from } = editor.state.selection;
  return $from.parent.textBetween(0, $from.parentOffset, undefined, TOKEN_BOUNDARY);
}

function getQueryFromText(text: string): string {
  const boundaryIdx = findLastWordBoundary(text);
  return boundaryIdx === -1 ? text : text.slice(boundaryIdx + 1);
}

function getCurrentWord(editor: Editor): { word: string; from: number; to: number } {
  const textBefore = getTextBeforeCursor(editor);
  const word = getQueryFromText(textBefore);
  const from = editor.state.selection.from - word.length;
  const to = editor.state.selection.from;
  return { word, from, to };
}

/**
 * Replaces the word before the caret with an empty filter token for `field` and puts
 * focus in the token's value, which opens its value suggestions. Every way a field is
 * chosen for a new token, by its delimiter or from the field suggestions, goes through
 * here.
 */
function insertEmptyFilterToken(editor: Editor, field: FieldDefinition): void {
  const { from, to } = getCurrentWord(editor);
  const id = generateTokenId();
  // Deleting the word, inserting the token and focusing it share one transaction and one
  // history entry, so no keystroke lands in the editor before the token has focus. The
  // empty token is not recorded in the history: entering its value is. When the user
  // leaves it empty, its removal is not recorded either.
  editor
    .chain()
    .focus()
    .deleteRange({ from, to })
    .insertFilterToken({ id, key: field.key, operator: field.operators[0], value: '' })
    .focusFilterToken(id, 'end')
    .command(({ tr }) => {
      withoutHistory(tr);
      return true;
    })
    .run();
}

/**
 * Turns the word before the caret into tokens when `trigger` ends it. The delimiter
 * after a field key starts an empty token for that field. Space and Tab read the word
 * as a query, as a paste of it would be read. Enter submits free text as it stands, so
 * only a filter is put in before the submit.
 */
export function tryAutoTokenize(editor: Editor, trigger: string): boolean {
  const context = getEditorContext(editor);
  const textBefore = getTextBeforeCursor(editor);
  if (isInsideQuotes(textBefore)) return false;

  const { word, from, to } = getCurrentWord(editor);
  if (!word) return false;

  if (trigger === context.delimiter) {
    const field = resolveField(context, word);
    if (!field) return false;

    insertEmptyFilterToken(editor, field);
    return true;
  }

  const freeTextMode = trigger === 'Enter' ? 'plain' : context.freeTextMode;
  const tr = editor.state.tr;
  if (!tokenizeRange(tr, from, to, { ...context, freeTextMode }, getFocusContext(editor))) {
    return false;
  }

  editor.view.dispatch(markAutoTokenized(tr));
  return true;
}

/** The text between the last token and the caret, and the document range it covers. */
function getPlainTextSegment(editor: Editor): { text: string; from: number; to: number } {
  const rawText = getTextBeforeCursor(editor);
  const textAfterToken = rawText.slice(rawText.lastIndexOf(TOKEN_BOUNDARY) + 1);

  const cursorPos = editor.state.selection.from;
  const from = cursorPos - textAfterToken.length;
  const to = cursorPos;

  return { text: textAfterToken, from, to };
}

export { getPlainTextSegment, getQueryFromText, getTextBeforeCursor, insertEmptyFilterToken };
