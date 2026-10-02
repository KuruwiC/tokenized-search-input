import type { Editor } from '@tiptap/core';
import { useCallback } from 'react';
import { getEditorContext } from '../../extensions/editor-context';
import { getDateInternalValue, getDateTimeInternalValue } from '../../pickers/date-format';
import { closeSuggestion } from '../../plugins/suggestion-plugin';
import { getTokenFocusState } from '../../plugins/token-focus-plugin';
import { exitTokenRight } from '../../tokens/composition';
import { applyTokenAction, commitFilterToken } from '../../tokens/filter-token/token-actions';
import type { DateTimeFieldDefinition } from '../../types';
import { isFilterToken } from '../../utils/node-predicates';

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

      const focusState = getTokenFocusState(editor.state);
      if (focusState?.focusedPos === null || focusState?.focusedPos === undefined) return;

      const pos = focusState.focusedPos;
      const node = editor.state.doc.nodeAt(pos);
      if (!node || !isFilterToken(node)) return;

      // Single transaction: update value, close suggestion, and exit token
      const tr = editor.state.tr;
      applyTokenAction(tr, node.attrs.id, { type: 'setValue', value }, getEditorContext(editor));
      closeSuggestion(tr);
      exitTokenRight(editor, pos + node.nodeSize, tr);
    },
    [editor]
  );

  // Date/datetime change from picker (real-time update)
  const handleDateChange = useCallback(
    (date: Date | null, fieldKey: string, isUTC?: boolean, includeTime?: boolean) => {
      if (!editor || !date) return;

      const focusState = getTokenFocusState(editor.state);
      if (focusState?.focusedPos === null || focusState?.focusedPos === undefined) return;

      const pos = focusState.focusedPos;
      const node = editor.state.doc.nodeAt(pos);
      if (!node || !isFilterToken(node)) return;

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
      if (
        applyTokenAction(tr, node.attrs.id, { type: 'setValue', value }, getEditorContext(editor))
      ) {
        editor.view.dispatch(tr);
      }
    },
    [editor]
  );

  // Close picker and exit token
  const handleDateClose = useCallback(() => {
    if (!editor) return;

    const focusState = getTokenFocusState(editor.state);
    const pos = focusState?.focusedPos;

    // Single transaction: close suggestion and exit token
    const tr = editor.state.tr;
    closeSuggestion(tr);

    if (pos !== null && pos !== undefined) {
      const node = tr.doc.nodeAt(pos);
      if (node && isFilterToken(node)) {
        commitFilterToken(tr, node.attrs.id, getEditorContext(editor));

        exitTokenRight(editor, pos + node.nodeSize, tr);
        // Show field suggestions after exiting token for consistency
        updateSuggestions();
        return;
      }
    }

    // Fallback: just dispatch if no valid position
    editor.view.dispatch(tr);
    updateSuggestions();
  }, [editor, updateSuggestions]);

  return { handleValueSelect, handleDateChange, handleDateClose };
}
