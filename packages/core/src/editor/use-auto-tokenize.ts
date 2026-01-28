import type { Editor } from '@tiptap/core';
import { parseTokenText } from '../serializer';
import { DEFAULT_TOKEN_DELIMITER, type FieldDefinition } from '../types';
import { isFilterToken } from '../utils/node-predicates';
import { findLastWordBoundary, isInsideQuotes } from '../utils/quoted-string';

function focusEmptyFilterToken(editor: Editor, fieldKey: string, onFocused?: () => void): void {
  requestAnimationFrame(() => {
    if (editor.isDestroyed) return;

    let tokenPos: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (isFilterToken(node) && node.attrs.key === fieldKey && !node.attrs.value) {
        tokenPos = pos;
        return false;
      }
      return true;
    });

    if (tokenPos !== null) {
      editor.commands.focusFilterToken(tokenPos, 'end');
      onFocused?.();
    }
  });
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

function insertFilterToken(
  editor: Editor,
  fields: FieldDefinition[],
  from: number,
  to: number,
  key: string,
  operator: string,
  value: string
): void {
  const fieldLabel = fields.find((f) => f.key === key)?.label || key;

  const chain = editor
    .chain()
    .deleteRange({ from, to })
    .insertFilterToken({ key, operator, value, fieldLabel });

  if (!value) {
    // Empty token creation should not be in history
    // When value is set, that transaction IS recorded
    // If user clicks away, emptyTokenCleanup deletes it (also not in history)
    chain.command(({ tr }) => {
      tr.setMeta('addToHistory', false);
      return true;
    });
  }

  chain.run();

  if (!value) {
    focusEmptyFilterToken(editor, key);
  }
}

export function tryAutoTokenize(
  editor: Editor,
  fields: FieldDefinition[],
  trigger: string,
  allowUnknownFields: boolean = false,
  unknownFieldOperators?: readonly string[],
  delimiter: string = DEFAULT_TOKEN_DELIMITER
): boolean {
  const textBefore = getTextBeforeCursor(editor);
  if (isInsideQuotes(textBefore)) return false;

  const { word, from, to } = getCurrentWord(editor);
  if (!word) return false;

  // Delimiter trigger creates an empty filter token for the field
  if (trigger === delimiter) {
    const field = fields.find((f) => f.key === word);
    if (!field) {
      if (allowUnknownFields) {
        const defaultOp = unknownFieldOperators?.[0] ?? 'is';
        insertFilterToken(editor, fields, from, to, word, defaultOp, '');
        return true;
      }
      return false;
    }

    insertFilterToken(editor, fields, from, to, field.key, field.operators[0], '');
    return true;
  }

  const parsed = parseTokenText(word, fields, {
    allowUnknownFields,
    unknownFieldOperators,
    delimiter,
  });
  if (!parsed) return false;

  insertFilterToken(editor, fields, from, to, parsed.key, parsed.operator, parsed.value);
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

export {
  focusEmptyFilterToken,
  getCurrentWord,
  getPlainTextSegment,
  getQueryFromText,
  getTextBeforeCursor,
};
