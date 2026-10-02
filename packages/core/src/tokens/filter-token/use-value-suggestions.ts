import type { Editor } from '@tiptap/core';
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { parseISOToDate } from '../../pickers/date-format';
import {
  closeSuggestion,
  getSuggestionState,
  isAnchoredToToken,
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
  tokenId: string;
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
  tokenId,
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
      // The suggestion of this token's value input goes away with the input.
      if (!editor.isDestroyed) {
        const suggestionState = getSuggestionState(editor.state);
        if (suggestionState && isAnchoredToToken(suggestionState.anchor, tokenId)) {
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
  }, [editor, tokenId]);

  // Open suggestions when value input receives focus
  const handleValueInputFocus = () => {
    if (!isMountedRef.current) return;
    if (!enabled) return;

    if (!canShowValueSuggestion(editor)) return;

    // Skip if picker is already open for THIS specific token (prevents re-opening on click)
    const currentState = getSuggestionState(editor.state);
    if (
      currentState &&
      isAnchoredToToken(currentState.anchor, tokenId) &&
      (currentState.type === 'date' || currentState.type === 'datetime')
    ) {
      return;
    }

    const tr = editor.state.tr;

    if (isEnumField && fieldDef?.type === 'enum' && fieldDef.enumValues) {
      // Enum field: show value suggestions
      openValueSuggestion(tr, fieldKey, fieldDef.enumValues, value, tokenId);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    } else if (isDateField) {
      // Date field: show date picker
      const currentDate = value ? parseISOToDate(value) : null;
      openDateSuggestion(tr, fieldKey, currentDate, tokenId);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    } else if (isDateTimeField) {
      // DateTime field: show datetime picker
      const currentDate = value ? parseISOToDate(value) : null;
      openDateTimeSuggestion(tr, fieldKey, currentDate, tokenId);
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
    openValueSuggestion(tr, fieldKey, filteredValues, value, tokenId);
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  }, [valueDisplay, value, editor, tokenId, fieldKey, fieldDef, enabled, isEnumField, inputRef]);

  return { handleValueInputFocus, handleValueInputBlur };
}
