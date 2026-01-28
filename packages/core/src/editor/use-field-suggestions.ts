import type { Editor } from '@tiptap/core';
import { useCallback } from 'react';
import {
  closeSuggestion,
  getSuggestionState,
  openFieldSuggestion,
} from '../plugins/suggestion-plugin';
import { canShowFieldSuggestion, getCurrentSuggestionType } from '../suggestions/suggestion-guards';
import type { FieldDefinition, Matcher } from '../types';
import { filterItems } from '../utils/filter-items';
import { isInsideQuotes } from '../utils/quoted-string';
import { focusEmptyFilterToken, getQueryFromText, getTextBeforeCursor } from './use-auto-tokenize';

export interface UseFieldSuggestionsOptions {
  /**
   * Matcher function for filtering field suggestions.
   * @default matchers.fuzzy
   */
  matcher?: Matcher;
}

function closeSuggestionAndDispatch(editor: Editor): void {
  const tr = editor.state.tr;
  closeSuggestion(tr);
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
}

export function useFieldSuggestions(
  editor: Editor | null,
  fields: FieldDefinition[],
  options?: UseFieldSuggestionsOptions
): {
  handleFieldSelect: (field: FieldDefinition) => void;
  updateSuggestions: (forceClose?: boolean) => void;
} {
  const handleFieldSelect = useCallback(
    (field: FieldDefinition) => {
      if (!editor) return;

      // Close field suggestions BEFORE content changes
      // This ensures metadata-only transaction doesn't interfere with history grouping
      closeSuggestionAndDispatch(editor);

      const textBefore = getTextBeforeCursor(editor);
      const query = getQueryFromText(textBefore);

      // Combine deleteRange + insertFilterToken in a single transaction
      // This ensures they are grouped together in history
      const chain = editor.chain().focus();

      if (query.length > 0) {
        const { state } = editor;
        const { selection } = state;
        const from = selection.from - query.length;
        const to = selection.from;
        chain.deleteRange({ from, to });
      }

      chain
        .insertFilterToken({
          key: field.key,
          operator: field.operators[0] || 'is',
          value: '',
          fieldLabel: field.label,
        })
        .command(({ tr }) => {
          // Empty token creation should not be in history
          // When value is set, that transaction IS recorded
          // If user clicks away, emptyTokenCleanup deletes it (also not in history)
          // This prevents orphaned history entries for incomplete tokens
          tr.setMeta('addToHistory', false);
          return true;
        })
        .run();

      // Focus the newly created token
      // Value suggestions for enum fields will be opened by FilterTokenView useEffect
      focusEmptyFilterToken(editor, field.key);
    },
    [editor]
  );

  const updateSuggestions = useCallback(
    (forceClose = false) => {
      if (!editor) return;

      const currentState = editor.view.state;
      const suggestionState = getSuggestionState(currentState);
      const currentType = getCurrentSuggestionType(currentState);

      // Check basic guard conditions using shared guard function
      if (!canShowFieldSuggestion(currentState)) {
        // Only close if current type is 'field' (don't interfere with other suggestions)
        if (currentType === 'field') {
          closeSuggestionAndDispatch(editor);
        }
        return;
      }

      // Additional gates: forceClose, not focused, or dismissed
      if (forceClose || !editor.isFocused || suggestionState?.dismissed) {
        closeSuggestionAndDispatch(editor);
        return;
      }

      const textBefore = getTextBeforeCursor(editor);

      // Don't show suggestions when cursor is inside quotes
      if (isInsideQuotes(textBefore)) {
        closeSuggestionAndDispatch(editor);
        return;
      }

      const query = getQueryFromText(textBefore);
      const filtered = filterItems(fields, query, (f) => [f.key, f.label], {
        matcher: options?.matcher,
      });
      const anchorPos = currentState.selection.from;

      const tr = currentState.tr;
      openFieldSuggestion(tr, filtered, query, anchorPos);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    },
    [editor, fields, options?.matcher]
  );

  return { handleFieldSelect, updateSuggestions };
}
