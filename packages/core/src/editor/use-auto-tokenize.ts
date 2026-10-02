import type { Editor } from '@tiptap/core';
import { getEditorContext, getFocusContext } from '../extensions/editor-context';
import { autoTokenizeKey } from '../plugins/auto-tokenize/plugin';
import { tokenizeRange } from '../plugins/auto-tokenize/tokenize-range';
import { isFilterToken } from '../utils/node-predicates';
import { findLastWordBoundary, isInsideQuotes } from '../utils/quoted-string';
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

// Object replacement characters (U+FFFC) representing non-text nodes
// are replaced with spaces to preserve word boundaries.
function getTextBeforeCursor(editor: Editor): string {
  const { state } = editor;
  const { selection } = state;
  const { $from } = selection;

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
  // Replace object replacement characters with spaces to preserve word boundaries
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
      tr.setMeta('addToHistory', false);
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

  editor.view.dispatch(tr.setMeta(autoTokenizeKey, true));
  return true;
}

/**
 * Get the plain text after the last token (or from start if no tokens).
 * Returns both the text and its position information for deletion.
 */
function getPlainTextSegment(editor: Editor): { text: string; from: number; to: number } {
  const { state } = editor;
  const { selection } = state;
  const { $from } = selection;

  // Get raw text with object replacement characters for tokens
  const rawText = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');

  // Find the last token position (object replacement character)
  const lastTokenIndex = rawText.lastIndexOf('\ufffc');

  // Extract text after the last token
  const textAfterToken = lastTokenIndex === -1 ? rawText : rawText.slice(lastTokenIndex + 1);

  // Calculate document positions
  const cursorPos = selection.from;
  const from = cursorPos - textAfterToken.length;
  const to = cursorPos;

  return { text: textAfterToken, from, to };
}

export { focusEmptyFilterToken, getPlainTextSegment, getQueryFromText, getTextBeforeCursor };
