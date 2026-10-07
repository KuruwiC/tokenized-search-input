import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { getEditorContext, getFocusContext } from '../extensions/editor-context';
import { tokenizeRange } from '../plugins/auto-tokenize/tokenize-range';
import { markAutoTokenized, withoutHistory } from '../plugins/shared/meta';
import {
  dispatchCloseSuggestion,
  getSuggestionState,
  isSuggestionOpen,
} from '../plugins/suggestion';
import {
  findLastWordBoundary,
  isInsideQuotes,
  isSpace,
  TOKEN_BOUNDARY,
} from '../serializer/quote-state';
import type { FieldDefinition, FreeTextMode } from '../types';
import { resolveField } from '../utils/resolve-field';
import { generateTokenId } from '../utils/token-id';
import { isTokenizeMode } from './keyboard/guards';

/** The paragraph text before `pos`, each token read as `TOKEN_BOUNDARY`. */
function paragraphTextBefore(doc: ProseMirrorNode, pos: number): string {
  const $pos = doc.resolve(pos);
  return $pos.parent.textBetween(0, $pos.parentOffset, undefined, TOKEN_BOUNDARY);
}

/** The paragraph text before the caret, each token read as `TOKEN_BOUNDARY`. */
function getTextBeforeCursor(editor: Editor): string {
  return paragraphTextBefore(editor.state.doc, editor.state.selection.from);
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
 * Text that typing or an input method puts in the paragraph, with the caret right after it:
 * `text` is to replace `from`-`to`, or, when `landed`, already stands there.
 */
export interface TypedText {
  from: number;
  to: number;
  text: string;
  landed: boolean;
}

function landTypedText(tr: Transaction, typed: TypedText | undefined): void {
  if (typed && !typed.landed) tr.insertText(typed.text, typed.from, typed.to);
}

/**
 * Replaces `range` (by default the word before the caret) with an empty filter token for
 * `field` and puts focus in the token's value, which opens its value suggestions. Every way a
 * field is chosen for a new token, by its delimiter or from the field suggestions, goes
 * through here. `range` is in the document once `typed` has landed in it.
 */
function insertEmptyFilterToken(
  editor: Editor,
  field: FieldDefinition,
  range: { from: number; to: number } = getCurrentWord(editor),
  typed?: TypedText
): void {
  const id = generateTokenId();
  // Deleting the word, inserting the token and focusing it share one transaction and one
  // history entry, so no keystroke lands in the editor before the token has focus. The
  // empty token is not recorded in the history: entering its value is. When the user
  // leaves it empty, its removal is not recorded either.
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      landTypedText(tr, typed);
      return true;
    })
    .deleteRange(range)
    .insertFilterToken({ id, key: field.key, operator: field.operators[0], value: '' })
    .focusFilterToken(id, 'end')
    .command(({ tr }) => {
      withoutHistory(tr);
      return true;
    })
    .run();
}

/**
 * Puts in `tr` the tokens that the word `textBefore` (the paragraph text up to `to`) ends with
 * holds, read as a paste of it would be. A word inside an open quote is still being typed.
 * Returns whether the document changed.
 */
function tokenizeWordEnd(
  editor: Editor,
  tr: Transaction,
  textBefore: string,
  to: number,
  freeTextMode: FreeTextMode
): boolean {
  if (isInsideQuotes(textBefore)) return false;
  const word = getQueryFromText(textBefore);
  if (!word) return false;
  const context = { ...getEditorContext(editor), freeTextMode };
  return tokenizeRange(tr, to - word.length, to, context, getFocusContext(editor));
}

/**
 * Turns the word before the caret into tokens when a key that types no text ends it. Tab
 * reads the word as Space does. Enter submits free text as it stands, so only a filter is
 * put in before the submit.
 */
export function tryAutoTokenize(editor: Editor, trigger: 'Tab' | 'Enter'): boolean {
  const freeTextMode = trigger === 'Enter' ? 'plain' : getEditorContext(editor).freeTextMode;
  const tr = editor.state.tr;
  const to = editor.state.selection.from;
  if (!tokenizeWordEnd(editor, tr, getTextBeforeCursor(editor), to, freeTextMode)) return false;
  editor.view.dispatch(markAutoTokenized(tr));
  return true;
}

/*
 * Each reading below gets the paragraph text before the character that asked for it, and the
 * caret after that character once `typed` has landed. The space is taken only when the word
 * puts in tokens.
 */

function readDelimiter(
  editor: Editor,
  typed: TypedText,
  textBefore: string,
  caret: number
): boolean {
  const context = getEditorContext(editor);
  if (isInsideQuotes(textBefore)) return false;
  const word = getQueryFromText(textBefore);
  if (!word) return false;
  const field = resolveField(context, word);
  if (!field) return false;
  const from = caret - context.delimiter.length - word.length;
  insertEmptyFilterToken(editor, field, { from, to: caret }, typed);
  return true;
}

function readSpace(editor: Editor, typed: TypedText, textBefore: string, caret: number): boolean {
  const tr = editor.state.tr;
  landTypedText(tr, typed);
  tr.delete(caret - 1, caret);
  const { freeTextMode } = getEditorContext(editor);
  if (!tokenizeWordEnd(editor, tr, textBefore, caret - 1, freeTextMode)) return false;
  editor.view.dispatch(markAutoTokenized(tr));
  return true;
}

function readQuote(editor: Editor, typed: TypedText, textBefore: string, caret: number): boolean {
  if (!isTokenizeMode(getEditorContext(editor).freeTextMode)) return false;
  const last = textBefore.slice(-1);
  if (last && !isSpace(last) && last !== TOKEN_BOUNDARY) return false;
  editor
    .chain()
    .command(({ tr }) => {
      landTypedText(tr, typed);
      return true;
    })
    .deleteRange({ from: caret - 1, to: caret })
    .insertFreeTextToken({ value: '', quoted: true, position: 'end' })
    .run();
  return true;
}

/**
 * Reads text that typing or an input method put before the caret by the character it ends
 * with: the delimiter after a field key starts an empty filter token for the field, a space
 * ends a word, and a quote at a word boundary starts quoted free text in tokenize mode. The
 * character is taken into the tokens it makes. Only that exact character counts; a full-width
 * colon or space, or a curly quote, is text.
 *
 * Reading the text that landed covers every way the text gets there: a keystroke, a
 * composition committed with the character in it, the character as a composition of its own,
 * and text an input method inserts with no key event of its own.
 *
 * Text an input method is still composing is not read: a token, and the focus that moves into
 * it, would take text the input method has yet to commit.
 *
 * @returns whether the text was read into tokens; it is left as text otherwise
 */
export function readTypedText(editor: Editor, typed: TypedText): boolean {
  const { delimiter } = getEditorContext(editor);
  const caret = typed.from + typed.text.length;
  const textToCaret = paragraphTextBefore(editor.state.doc, typed.from) + typed.text;
  const before = (trigger: string) => textToCaret.slice(0, -trigger.length);
  const suggestionWasOpen = isSuggestionOpen(getSuggestionState(editor.state));

  const last = typed.text.slice(-1);
  let read = false;
  if (typed.text.endsWith(delimiter)) {
    read = readDelimiter(editor, typed, before(delimiter), caret);
  } else if (isSpace(last)) {
    read = readSpace(editor, typed, before(last), caret);
  } else if (last === '"') {
    read = readQuote(editor, typed, before(last), caret);
  }
  if (read && suggestionWasOpen) dispatchCloseSuggestion(editor.view);
  return read;
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
