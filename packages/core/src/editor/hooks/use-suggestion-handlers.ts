import type { Editor } from '@tiptap/core';
import { useCallback } from 'react';
import { getDateInternalValue, getDateTimeInternalValue } from '../../pickers/date-format';
import { closeSuggestion } from '../../plugins/suggestion-plugin';
import { getTokenFocusState } from '../../plugins/token-focus-plugin';
import { exitTokenRight } from '../../tokens/composition';
import { commitFilterToken } from '../../tokens/filter-token/commit-token';
import type { DateTimeFieldDefinition, FieldDefinition } from '../../types';
import { isFilterToken } from '../../utils/node-predicates';
import { updateTokenAttrs } from '../../utils/token-attrs';

export interface UseSuggestionHandlersOptions {
  editor: Editor | null;
  fields: FieldDefinition[];
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
        confirmed: true,
      });
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
      const fieldDef = fields.find((f) => f.key === fieldKey);
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

      // Clear display metadata so resolveDisplayValue can resolve fresh value
      const tr = editor.state.tr;
      updateTokenAttrs(tr, pos, {
        value,
        displayValue: null,
        startContent: null,
        endContent: null,
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
      if (node && isFilterToken(node)) {
        // Get field definition for immutable/validate check
        const fieldKey = node.attrs.key;
        const fieldDef = fields.find((f) => f.key === fieldKey);

        // Commit token (confirm + immutable + validation)
        commitFilterToken({
          tr,
          pos,
          fieldDef,
          validate: fieldDef?.validate,
        });

        exitTokenRight(editor, pos + node.nodeSize, tr);
        // Show field suggestions after exiting token for consistency
        updateSuggestions();
        return;
      }
    }

    // Fallback: just dispatch if no valid position
    editor.view.dispatch(tr);
    updateSuggestions();
  }, [editor, fields, updateSuggestions]);

  return { handleValueSelect, handleDateChange, handleDateClose };
}
