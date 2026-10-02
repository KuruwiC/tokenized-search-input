import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { useEffect, useRef } from 'react';
import { parseDateFieldValue } from '../../pickers/date-format';
import { updateSuggestionQuery } from '../../plugins/shared/meta';
import {
  getSuggestionState,
  isAnchoredToToken,
  openDateSuggestion,
  openDateTimeSuggestion,
  openValueSuggestion,
} from '../../plugins/suggestion-plugin';
import { canShowValueSuggestion } from '../../suggestions/suggestion-guards';
import type { FieldDefinition } from '../../types';

export interface UseValueSuggestionsOptions {
  editor: Editor;
  tokenId: string;
  fieldKey: string;
  fieldDef: FieldDefinition | undefined;
  value: string;
  enabled: boolean;
}

export interface UseValueSuggestionsReturn {
  handleValueInputFocus: () => void;
  /**
   * Marks the transaction that writes a typed value, so the value suggestions are
   * shown for it even after the user dismissed them.
   */
  addSuggestionQuery: (tr: Transaction) => void;
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
 * - Close: the dismiss manager closes them when focus or a press lands outside the value input
 * - Update: the suggestion plugin derives the query from the token's value; typing
 *   also shows suggestions the user dismissed
 */
export function useValueSuggestions({
  editor,
  tokenId,
  fieldKey,
  fieldDef,
  value,
  enabled,
}: UseValueSuggestionsOptions): UseValueSuggestionsReturn {
  const isEnumField =
    fieldDef?.type === 'enum' && fieldDef.enumValues && fieldDef.enumValues.length > 0;

  // Track whether we should manage suggestions (to avoid updates after unmount)
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    } else if (fieldDef?.type === 'date' || fieldDef?.type === 'datetime') {
      const parsed = value ? parseDateFieldValue(value, fieldDef) : null;
      const current = parsed?.ok ? parsed.value : null;
      if (fieldDef.type === 'date') {
        // Date field: show date picker
        openDateSuggestion(tr, fieldKey, current, tokenId);
      } else {
        // DateTime field: show datetime picker
        openDateTimeSuggestion(tr, fieldKey, current, tokenId);
      }
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    }
  };

  const addSuggestionQuery = (tr: Transaction) => {
    if (!enabled || !isEnumField) return;
    updateSuggestionQuery(tr, tokenId);
  };

  return { handleValueInputFocus, addSuggestionQuery };
}
