import type { Editor } from '@tiptap/core';
import { useCallback } from 'react';
import { getEditorContext, getFocusContext } from '../../extensions/editor-context';
import { toStoredValue } from '../../pickers/date-format';
import { checkDateTimeValue, type DateTimeValue } from '../../pickers/date-time-value';
import { closeSuggestion } from '../../plugins/suggestion';
import { getFocusedToken, leaveTokenIn } from '../../plugins/token-focus';
import { applyTokenAction } from '../../tokens/filter-token/token-actions';
import { findTokenById } from '../../utils/find-token';
import { isFilterToken } from '../../utils/node-predicates';

function focusedFilterTokenId(editor: Editor): string | null {
  const id = getFocusedToken(editor.state)?.id;
  if (id === undefined) return null;
  const found = findTokenById(editor.state.doc, id);
  return found && isFilterToken(found.node) ? id : null;
}

export interface UseSuggestionHandlersOptions {
  editor: Editor | null;
  updateSuggestions: () => void;
}

export interface UseSuggestionHandlersResult {
  handleValueSelect: (value: string) => void;
  handleDateChange: (value: DateTimeValue | null, fieldKey: string) => void;
  handleDateClose: () => void;
}

export function useSuggestionHandlers({
  editor,
  updateSuggestions,
}: UseSuggestionHandlersOptions): UseSuggestionHandlersResult {
  const handleValueSelect = useCallback(
    (value: string) => {
      if (!editor) return;

      const id = focusedFilterTokenId(editor);
      if (id === null) return;

      // Single transaction: set the chosen value and leave the token
      const tr = editor.state.tr;
      leaveTokenIn(tr, getFocusContext(editor), id, { direction: 'right', value });
      editor.view.dispatch(tr);
      editor.view.focus();
    },
    [editor]
  );

  const handleDateChange = useCallback(
    (value: DateTimeValue | null, fieldKey: string) => {
      if (!editor || !value) return;

      const id = focusedFilterTokenId(editor);
      if (id === null) return;

      const fieldDef = getEditorContext(editor).fields.find((f) => f.key === fieldKey);
      if (fieldDef?.type !== 'date' && fieldDef?.type !== 'datetime') return;

      // A custom picker's value is not checked by the compiler: only one that can be written is stored
      const checked = checkDateTimeValue(value);
      if (!checked.ok) return;

      const tr = editor.state.tr;
      const action = { type: 'setValue', value: toStoredValue(checked.value, fieldDef) } as const;
      if (applyTokenAction(tr, id, action, getEditorContext(editor))) {
        editor.view.dispatch(tr);
      }
    },
    [editor]
  );

  const handleDateClose = useCallback(() => {
    if (!editor) return;

    const id = focusedFilterTokenId(editor);

    // Single transaction: close suggestion and leave the token
    const tr = editor.state.tr;
    closeSuggestion(tr);
    if (id !== null) leaveTokenIn(tr, getFocusContext(editor), id, { direction: 'right' });
    editor.view.dispatch(tr);
    if (id !== null) editor.view.focus();
    // Show field suggestions after leaving the token for consistency
    updateSuggestions();
  }, [editor, updateSuggestions]);

  return { handleValueSelect, handleDateChange, handleDateClose };
}
