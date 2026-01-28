import type { Editor } from '@tiptap/core';
import { useCallback } from 'react';
import { getDateInternalValue, getDateTimeInternalValue } from '../../pickers/date-format';
import { closeSuggestion } from '../../plugins/suggestion-plugin';
import { getTokenFocusState } from '../../plugins/token-focus-plugin';
import { exitTokenRight } from '../../tokens/composition';
import type { DateFieldDefinition, DateTimeFieldDefinition, FieldDefinition } from '../../types';
import { isFilterToken } from '../../utils/node-predicates';
import { updateTokenAttrs } from '../../utils/token-attrs';

export interface UseSuggestionHandlersOptions {
  editor: Editor | null;
  fields: FieldDefinition[];
  updateSuggestions: () => void;
}

export interface UseSuggestionHandlersResult {
  handleValueSelect: (value: string) => void;
  handleDateChange: (date: Date | null, fieldKey: string, isUTC?: boolean) => void;
  handleDateClose: () => void;
}

export function useSuggestionHandlers({
  editor,
  fields,
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
      // Clear display metadata so resolveDisplayValue can resolve from enumValues
      const tr = editor.state.tr;
      updateTokenAttrs(tr, pos, {
        value,
        displayValue: null,
        startContent: null,
        endContent: null,
        invalid: false,
      });
      closeSuggestion(tr);
      exitTokenRight(editor, pos + node.nodeSize, tr);
    },
    [editor]
  );

  // Date/datetime change from picker (real-time update)
  const handleDateChange = useCallback(
    (date: Date | null, fieldKey: string, isUTC?: boolean) => {
      if (!editor || !date) return;

      const focusState = getTokenFocusState(editor.state);
      if (focusState?.focusedPos === null || focusState?.focusedPos === undefined) return;

      const pos = focusState.focusedPos;
      const node = editor.state.doc.nodeAt(pos);
      if (!node || !isFilterToken(node)) return;

      // Find field definition to get format config
      const fieldDef = fields.find((f) => f.key === fieldKey);
      if (!fieldDef) return;

      // Format date according to field configuration
      let value: string;
      if (fieldDef.type === 'datetime') {
        const dtFieldDef = fieldDef as DateTimeFieldDefinition;
        value = getDateTimeInternalValue(date, dtFieldDef.formatConfig, isUTC);
      } else {
        const dateFieldDef = fieldDef as DateFieldDefinition;
        value = getDateInternalValue(date, dateFieldDef.formatConfig);
      }

      const tr = editor.state.tr;
      updateTokenAttrs(tr, pos, {
        value,
        invalid: false,
      });
      editor.view.dispatch(tr);
    },
    [editor, fields]
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
      if (node) {
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
