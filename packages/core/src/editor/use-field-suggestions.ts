import type { Editor } from '@tiptap/core';
import { useCallback } from 'react';
import { getEditorContext } from '../extensions/editor-context';
import { withoutHistory } from '../plugins/shared/meta';
import { closeSuggestion, getSuggestionState, openFieldSuggestion } from '../plugins/suggestion';
import { isInsideQuotes } from '../serializer/quote-state';
import { canShowFieldSuggestion, getCurrentSuggestionType } from '../suggestions/suggestion-guards';
import type { FieldDefinition, Matcher } from '../types';
import { filterItems } from '../utils/filter-items';
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
  editor.view.dispatch(tr);
}

export function useFieldSuggestions(
  editor: Editor | null,
  options?: UseFieldSuggestionsOptions
): {
  handleFieldSelect: (field: FieldDefinition) => void;
  updateSuggestions: (forceClose?: boolean) => void;
} {
  const handleFieldSelect = useCallback(
    (field: FieldDefinition) => {
      if (!editor) return;

      // Close the suggestion before the content changes, so the metadata-only
      // transaction does not interfere with history grouping.
      closeSuggestionAndDispatch(editor);

      const textBefore = getTextBeforeCursor(editor);
      const query = getQueryFromText(textBefore);

      // Deleting the query and inserting the token share one history entry.
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
        })
        .command(({ tr }) => {
          // The empty token is not recorded in the history: entering its value is. When the
          // user leaves it empty, its removal is not recorded either.
          withoutHistory(tr);
          return true;
        })
        .run();

      // Focusing the token's value input opens its value suggestions (useValueSuggestions).
      focusEmptyFilterToken(editor, field.key);
    },
    [editor]
  );

  const updateSuggestions = useCallback(
    (forceClose = false) => {
      if (!editor) return;

      const currentState = editor.state;
      const suggestionState = getSuggestionState(currentState);
      const currentType = getCurrentSuggestionType(currentState);

      if (!canShowFieldSuggestion(editor)) {
        // Only close if current type is 'field' (don't interfere with other suggestions)
        if (currentType === 'field') {
          closeSuggestionAndDispatch(editor);
        }
        return;
      }

      if (forceClose || !editor.isFocused || suggestionState?.dismissed) {
        closeSuggestionAndDispatch(editor);
        return;
      }

      const textBefore = getTextBeforeCursor(editor);

      if (isInsideQuotes(textBefore)) {
        closeSuggestionAndDispatch(editor);
        return;
      }

      const query = getQueryFromText(textBefore);
      const filtered = filterItems(
        getEditorContext(editor).fields,
        query,
        (f) => [f.key, f.label],
        {
          matcher: options?.matcher,
        }
      );
      const anchorPos = currentState.selection.from;

      const tr = currentState.tr;
      openFieldSuggestion(tr, filtered, query, anchorPos);
      editor.view.dispatch(tr);
    },
    [editor, options?.matcher]
  );

  return { handleFieldSelect, updateSuggestions };
}
