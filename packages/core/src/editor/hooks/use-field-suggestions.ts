import type { Editor } from '@tiptap/core';
import { useCallback } from 'react';
import { getEditorContext } from '../../extensions/editor-context';
import {
  dispatchCloseSuggestion,
  getSuggestionState,
  openFieldSuggestion,
} from '../../plugins/suggestion';
import { isInsideQuotes } from '../../serializer/quote-state';
import {
  canShowFieldSuggestion,
  getCurrentSuggestionType,
} from '../../suggestions/suggestion-guards';
import type { FieldDefinition, Matcher } from '../../types';
import { filterItems } from '../../utils/filter-items';
import { getQueryFromText, getTextBeforeCursor, insertEmptyFilterToken } from '../auto-tokenize';

export interface UseFieldSuggestionsOptions {
  /**
   * Matcher function for filtering field suggestions.
   * @default matchers.fuzzy
   */
  matcher?: Matcher;
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
      dispatchCloseSuggestion(editor.view);

      insertEmptyFilterToken(editor, field);
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
          dispatchCloseSuggestion(editor.view);
        }
        return;
      }

      if (forceClose || !editor.isFocused || suggestionState?.dismissed) {
        dispatchCloseSuggestion(editor.view);
        return;
      }

      const textBefore = getTextBeforeCursor(editor);

      if (isInsideQuotes(textBefore)) {
        dispatchCloseSuggestion(editor.view);
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
