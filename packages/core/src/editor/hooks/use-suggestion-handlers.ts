import type { Editor } from '@tiptap/core';
import { useCallback } from 'react';
import { getEditorContext } from '../../extensions/editor-context';
import { getDateInternalValue, getDateTimeInternalValue } from '../../pickers/date-format';
import { closeSuggestion } from '../../plugins/suggestion-plugin';
import { getFocusedToken } from '../../plugins/token-focus-plugin';
import { applyTokenAction } from '../../tokens/filter-token/token-actions';
import { leaveTokenIn } from '../../tokens/token-focus';
import type { DateTimeFieldDefinition } from '../../types';
import { findTokenById } from '../../utils/find-token';
import { isFilterToken } from '../../utils/node-predicates';

/** The id of the filter token being edited, if one is. */
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
  handleDateChange: (
    date: Date | null,
    fieldKey: string,
    isUTC?: boolean,
    includeTime?: boolean
  ) => void;
  handleDateClose: () => void;
}

export function useSuggestionHandlers({
  editor,
  updateSuggestions,
}: UseSuggestionHandlersOptions): UseSuggestionHandlersResult {
  // Value selection from suggestions
  const handleValueSelect = useCallback(
    (value: string) => {
      if (!editor) return;

      const id = focusedFilterTokenId(editor);
      if (id === null) return;

      // Single transaction: update the value and leave the token
      const tr = editor.state.tr;
      applyTokenAction(tr, id, { type: 'setValue', value }, getEditorContext(editor));
      leaveTokenIn(tr, editor, id, 'right');
      editor.view.dispatch(tr);
      editor.view.focus();
    },
    [editor]
  );

  // Date/datetime change from picker (real-time update)
  const handleDateChange = useCallback(
    (date: Date | null, fieldKey: string, isUTC?: boolean, includeTime?: boolean) => {
      if (!editor || !date) return;

      const id = focusedFilterTokenId(editor);
      if (id === null) return;

      // Find field definition to get format config
      const fieldDef = getEditorContext(editor).fields.find((f) => f.key === fieldKey);
      if (!fieldDef) return;

      let value: string;
      if (fieldDef.type === 'datetime') {
        const dtFieldDef = fieldDef as DateTimeFieldDefinition;
        // When timeRequired is true, always use datetime format regardless of includeTime
        const shouldIncludeTime = dtFieldDef.timeRequired || includeTime !== false;
        if (shouldIncludeTime) {
          value = getDateTimeInternalValue(date, dtFieldDef.formatConfig, isUTC);
        } else {
          value = getDateInternalValue(date);
        }
      } else {
        value = getDateInternalValue(date);
      }

      const tr = editor.state.tr;
      if (applyTokenAction(tr, id, { type: 'setValue', value }, getEditorContext(editor))) {
        editor.view.dispatch(tr);
      }
    },
    [editor]
  );

  // Close picker and exit token
  const handleDateClose = useCallback(() => {
    if (!editor) return;

    const id = focusedFilterTokenId(editor);

    // Single transaction: close suggestion and leave the token
    const tr = editor.state.tr;
    closeSuggestion(tr);
    if (id !== null) leaveTokenIn(tr, editor, id, 'right');
    editor.view.dispatch(tr);
    if (id !== null) editor.view.focus();
    // Show field suggestions after leaving the token for consistency
    updateSuggestions();
  }, [editor, updateSuggestions]);

  return { handleValueSelect, handleDateChange, handleDateClose };
}
