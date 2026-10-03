import type { Editor } from '@tiptap/core';
import { getEditorContext, getFocusContext } from '../extensions/editor-context';
import { tokenizeRange } from '../plugins/auto-tokenize/tokenize-range';
import { markAutoTokenized, withoutHistory } from '../plugins/shared/meta';
import { findLastWordBoundary, isInsideQuotes } from '../serializer/quote-state';
import { isFilterToken } from '../utils/node-predicates';
import { resolveField } from '../utils/resolve-field';

function focusEmptyFilterToken(editor: Editor, fieldKey: string, onFocused?: () => void): void {
  if (editor.isDestroyed) return;

  let tokenId: string | null = null;
  editor.state.doc.descendants((node) => {
    if (isFilterToken(node) && node.attrs.key === fieldKey && !node.attrs.value) {
      tokenId = String(node.attrs.id);
      return false;
    }
    return true;
  });

  // Set the plugin focus state synchronously. Deferring this until the next
  // animation frame leaves a window where subsequent keystrokes are inserted
  // into the editor instead of the newly-created token input.
  if (tokenId !== null) {
    editor.commands.focusFilterToken(tokenId, 'end');
    onFocused?.();
  }
}

// A token node reads as U+FFFC; it becomes a space so it still ends a word.
function getTextBeforeCursor(editor: Editor): string {
  const { state } = editor;
  const { selection } = state;
  const { $from } = selection;

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
  return textBefore.replaceAll('\ufffc', ' ');
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

function insertEmptyFilterToken(
  editor: Editor,
  from: number,
  to: number,
  key: string,
  operator: string
): void {
  // The empty token is not recorded in the history: entering its value is. When the
  // user leaves it empty, its removal is not recorded either.
  editor
    .chain()
    .deleteRange({ from, to })
    .insertFilterToken({ key, operator, value: '' })
    .command(({ tr }) => {
      withoutHistory(tr);
      return true;
    })
    .run();

  focusEmptyFilterToken(editor, key);
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

    insertEmptyFilterToken(editor, from, to, field.key, field.operators[0]);
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
  const { state } = editor;
  const { selection } = state;
  const { $from } = selection;

  const rawText = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');

  const lastTokenIndex = rawText.lastIndexOf('\ufffc');

  const textAfterToken = lastTokenIndex === -1 ? rawText : rawText.slice(lastTokenIndex + 1);

  const cursorPos = selection.from;
  const from = cursorPos - textAfterToken.length;
  const to = cursorPos;

  return { text: textAfterToken, from, to };
}

export { focusEmptyFilterToken, getPlainTextSegment, getQueryFromText, getTextBeforeCursor };
