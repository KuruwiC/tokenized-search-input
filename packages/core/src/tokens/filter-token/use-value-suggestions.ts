import type { Editor } from '@tiptap/core';
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { parseISOToDate } from '../../pickers/date-format';
import {
  closeSuggestion,
  getSuggestionState,
  openDateSuggestion,
  openDateTimeSuggestion,
  openValueSuggestion,
} from '../../plugins/suggestion-plugin';
import { getDismissPolicy } from '../../suggestions/dismiss-policy';
import { canShowValueSuggestion } from '../../suggestions/suggestion-guards';
import type { FieldDefinition } from '../../types';
import { filterEnumValues } from '../../utils/enum-value';

export interface UseValueSuggestionsOptions {
  editor: Editor;
  getPos: () => number | undefined;
  inputRef: RefObject<HTMLInputElement | null>;
  fieldKey: string;
  fieldDef: FieldDefinition | undefined;
  value: string;
  valueDisplay: string;
  enabled: boolean;
}

export interface UseValueSuggestionsReturn {
  handleValueInputFocus: () => void;
  handleValueInputBlur: (e: React.FocusEvent) => void;
}

/**
 * Hook for managing value suggestions based on value input focus state.
 *
 * Architectural principle: Value suggestions are tied to the actual DOM focus state
 * of the value input element. This ensures predictable behavior regardless of how
 * focus arrives (keyboard navigation, click, tab, etc.).
 *
 * Trigger points:
 * - Open: value input receives focus (focus event)
 * - Close: value input loses focus (blur event), unless focus moved to suggestion list
 * - Update: value changes while input is focused
 */
export function useValueSuggestions({
  editor,
  getPos,
  inputRef,
  fieldKey,
  fieldDef,
  value,
  valueDisplay,
  enabled,
}: UseValueSuggestionsOptions): UseValueSuggestionsReturn {
  const isEnumField =
    fieldDef?.type === 'enum' && fieldDef.enumValues && fieldDef.enumValues.length > 0;
  const isDateField = fieldDef?.type === 'date';
  const isDateTimeField = fieldDef?.type === 'datetime';

  // Track whether we should manage suggestions (to avoid updates after unmount)
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Safety: close suggestion if this specific token unmounts.
      if (!editor.isDestroyed) {
        const suggestionState = getSuggestionState(editor.state);
        // Only close if it's OUR suggestion (check fieldKey to avoid closing others)
        const isOurSuggestion =
          suggestionState?.fieldKey === fieldKey &&
          (suggestionState?.type === 'value' ||
            suggestionState?.type === 'date' ||
            suggestionState?.type === 'datetime');
        if (isOurSuggestion) {
          try {
            const tr = editor.state.tr;
            closeSuggestion(tr);
            tr.setMeta('addToHistory', false);
            editor.view.dispatch(tr);
          } catch {
            // Editor might be in an unstable state during teardown
          }
        }
      }
    };
  }, [editor, fieldKey]);

  // Open suggestions when value input receives focus
  const handleValueInputFocus = () => {
    if (!isMountedRef.current) return;
    if (!enabled) return;

    if (!canShowValueSuggestion(editor.state)) return;

    const pos = getPos();
    const anchorPos = typeof pos === 'number' ? pos : null;

    // Skip if picker is already open for THIS specific token (prevents re-opening on click)
    const currentState = getSuggestionState(editor.state);
    if (
      typeof pos === 'number' &&
      currentState?.anchorPos === pos &&
      (currentState.type === 'date' || currentState.type === 'datetime')
    ) {
      return;
    }

    const tr = editor.state.tr;

    if (isEnumField && fieldDef?.type === 'enum' && fieldDef.enumValues) {
      // Enum field: show value suggestions
      openValueSuggestion(tr, fieldKey, fieldDef.enumValues, value, anchorPos);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    } else if (isDateField) {
      // Date field: show date picker
      const currentDate = value ? parseISOToDate(value) : null;
      openDateSuggestion(tr, fieldKey, currentDate, anchorPos);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    } else if (isDateTimeField) {
      // DateTime field: show datetime picker
      const currentDate = value ? parseISOToDate(value) : null;
      openDateTimeSuggestion(tr, fieldKey, currentDate, anchorPos);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    }
  };

  // Close suggestions when value input loses focus
  // Note: value/date/datetime use dismissOnBlur: false and rely on useDismissManager's focusin handler
  // This handler only processes blur for types with dismissOnBlur: true (e.g., field)
  const handleValueInputBlur = (_e: React.FocusEvent) => {
    if (!isMountedRef.current) return;

    const suggestionState = getSuggestionState(editor.state);
    if (!suggestionState?.type) return;

    const policy = getDismissPolicy(suggestionState.type);

    // Let useDismissManager handle dismiss via focusin event for types with dismissOnFocusOutside
    if (!policy.dismissOnBlur) return;

    // For blur-dismissable types, close immediately
    // (Currently no value-related types use dismissOnBlur: true, but keeping for future extensibility)
    const tr = editor.state.tr;
    closeSuggestion(tr);
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  };

  // Update suggestions when value changes (only while input is focused)
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (!enabled) return;
    if (!isEnumField || !fieldDef?.enumValues) return;

    // Only update if value input is currently focused
    if (document.activeElement !== inputRef.current) return;

    // Use current input text for filtering (what user is actually typing)
    // This ensures filtering works correctly even when display value differs from raw value
    const currentInputText = inputRef.current?.value ?? valueDisplay;

    const tr = editor.state.tr;
    const filteredValues = filterEnumValues(fieldDef.enumValues, currentInputText, {
      matcher: fieldDef.suggestionMatcher,
    });
    const anchorPos = typeof getPos() === 'number' ? getPos() : null;
    openValueSuggestion(tr, fieldKey, filteredValues, value, anchorPos);
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  }, [valueDisplay, value, editor, getPos, fieldKey, fieldDef, enabled, isEnumField, inputRef]);

  return { handleValueInputFocus, handleValueInputBlur };
}
