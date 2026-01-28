import type { Editor } from '@tiptap/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  closeSuggestion,
  getSuggestionState,
  openCustomSuggestion,
  openFieldWithCustomSuggestion,
} from '../plugins/suggestion-plugin';
import { canShowCustomSuggestion, isSuggestionDismissed } from '../suggestions/suggestion-guards';
import type {
  CustomSuggestion,
  CustomSuggestionConfig,
  CustomSuggestionResult,
  ExistingToken,
  ExistingTokenWithId,
  FieldDefinition,
  SuggestFnReturn,
  SuggestionErrorContext,
} from '../types';
import { isWithinToken } from '../utils/dom-focus';
import { isFilterToken } from '../utils/node-predicates';
import { isInsideQuotes } from '../utils/quoted-string';
import { getPlainTextSegment } from './use-auto-tokenize';

const DEFAULT_DEBOUNCE_MS = 150;
const DEFAULT_MAX_SUGGESTIONS = 5;
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Default error handler (Strategy pattern default).
 */
const defaultErrorHandler = (error: Error, context: SuggestionErrorContext): void => {
  console.error(
    `[TokenizedSearchInput] ${context.type} failed for query "${context.query}":`,
    error
  );
};

/**
 * Create a promise with timeout.
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, _query: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Suggestion request timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);

function normalizeResult(result: Awaited<SuggestFnReturn>): CustomSuggestionResult {
  if (Array.isArray(result)) {
    return { suggestions: result, hasMore: false };
  }
  return result;
}

function collectExistingTokens(editor: Editor): ExistingToken[] {
  const tokens: ExistingToken[] = [];
  editor.state.doc.descendants((node) => {
    if (isFilterToken(node) && node.attrs.value) {
      tokens.push({
        key: node.attrs.key || '',
        operator: node.attrs.operator || 'is',
        value: String(node.attrs.value),
      });
    }
    return true;
  });
  return tokens;
}

function collectExistingTokensWithId(editor: Editor): ExistingTokenWithId[] {
  const tokens: ExistingTokenWithId[] = [];
  editor.state.doc.descendants((node) => {
    if (isFilterToken(node) && node.attrs.value && node.attrs.id) {
      tokens.push({
        key: node.attrs.key || '',
        operator: node.attrs.operator || 'is',
        value: String(node.attrs.value),
        id: node.attrs.id,
      });
    }
    return true;
  });
  return tokens;
}

interface UseCustomSuggestionsResult {
  handleCustomSelect: (suggestion: CustomSuggestion) => void;
  updateCustomSuggestions: () => void;
  /** Whether more suggestions can be loaded */
  hasMore: boolean;
  /** Whether loadMore is currently in progress */
  isLoadingMore: boolean;
  /** Load more suggestions (for infinite scroll) */
  loadMore: () => void;
}

export function useCustomSuggestions(
  editor: Editor | null,
  fields: FieldDefinition[],
  config: CustomSuggestionConfig | undefined
): UseCustomSuggestionsResult {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRequestRef = useRef<number>(0);

  // Pagination state
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const currentQueryRef = useRef<string>('');
  const currentOffsetRef = useRef<number>(0);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleCustomSelect = useCallback(
    (suggestion: CustomSuggestion) => {
      if (!editor) return;

      // Delete the plain text segment (text after the last token up to cursor)
      const { text, from, to } = getPlainTextSegment(editor);
      if (text.trim().length > 0 && from >= 0 && from < to) {
        editor.chain().focus().deleteRange({ from, to }).run();
      }

      // Call onSelect if provided
      if (config?.onSelect) {
        const existingTokens = collectExistingTokensWithId(editor);
        const deleteToken = (id: string) => {
          // Find token by ID and delete it
          let found = false;
          editor.state.doc.descendants((node, pos) => {
            if (!found && isFilterToken(node) && node.attrs.id === id) {
              editor
                .chain()
                .focus()
                .deleteRange({ from: pos, to: pos + node.nodeSize })
                .run();
              found = true;
              return false;
            }
            return true;
          });
        };

        const handled = config.onSelect(suggestion, { existingTokens, deleteToken });
        if (handled) {
          // Close suggestions and reset pagination state
          const tr = editor.state.tr;
          closeSuggestion(tr);
          tr.setMeta('addToHistory', false);
          editor.view.dispatch(tr);
          setHasMore(false);
          currentOffsetRef.current = 0;
          return;
        }
      }

      // Default behavior: Insert all tokens from the suggestion
      let chain = editor.chain().focus();
      for (const token of suggestion.tokens) {
        const fieldDef = fields.find((f) => f.key === token.key);
        chain = chain.insertFilterToken({
          key: token.key,
          operator: token.operator,
          value: token.value,
          fieldLabel: fieldDef?.label ?? token.key,
          displayValue: token.displayValue,
          startContent: token.startContent,
          endContent: token.endContent,
        });
      }
      chain.run();

      // Close suggestions and reset pagination state
      const tr = editor.state.tr;
      closeSuggestion(tr);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
      setHasMore(false);
      currentOffsetRef.current = 0;
    },
    [editor, fields, config]
  );

  const updateCustomSuggestions = useCallback(() => {
    // Helper to cancel pending requests and invalidate in-flight responses
    const cancelPendingRequest = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Increment to invalidate any in-flight async responses
      pendingRequestRef.current++;
    };

    if (!editor || !config) return;

    const currentState = editor.state;

    // Check basic guard conditions using shared guard function
    if (!canShowCustomSuggestion(currentState)) {
      cancelPendingRequest();
      return;
    }

    // Gate: not focused or dismissed
    if (!editor.isFocused || isSuggestionDismissed(currentState)) {
      cancelPendingRequest();
      return;
    }

    // Also check DOM focus for cases where plugin state hasn't updated yet
    if (isWithinToken(document.activeElement)) {
      cancelPendingRequest();
      return;
    }

    // Get plain text segment (text after last token up to cursor)
    const { text: plainTextSegment } = getPlainTextSegment(editor);

    // Don't show suggestions when cursor is inside quotes
    if (isInsideQuotes(plainTextSegment)) {
      cancelPendingRequest();
      return;
    }

    // Use trimmed plain text segment as query for custom suggestions
    // This ensures we only consider text between the last token and cursor
    const query = plainTextSegment.trim();

    // Cancel previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const debounceMs = config.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const requestId = ++pendingRequestRef.current;

    debounceTimerRef.current = setTimeout(async () => {
      // Check if this request is still the latest
      if (requestId !== pendingRequestRef.current) return;

      // Re-check if focus is within token (may have changed during debounce)
      if (isWithinToken(document.activeElement)) return;

      const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const onError = config.onError ?? defaultErrorHandler;

      try {
        const existingTokens = collectExistingTokens(editor);
        const suggestPromise = Promise.resolve(config.suggest({ query, fields, existingTokens }));
        const rawResult = await withTimeout(suggestPromise, timeoutMs, query);

        // Check again if this request is still the latest
        if (requestId !== pendingRequestRef.current) return;

        // Check if editor is still valid
        if (!editor || editor.isDestroyed) return;

        // Normalize result to handle both array and object returns
        const result = normalizeResult(rawResult);

        const maxSuggestions = config.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS;
        const suggestions = result.suggestions.slice(0, maxSuggestions);

        // Update pagination state
        currentQueryRef.current = query;
        currentOffsetRef.current = suggestions.length;
        setHasMore(result.hasMore ?? false);

        if (suggestions.length === 0) {
          // No custom suggestions - close if custom type is open, otherwise let field suggestions show
          const currentState = getSuggestionState(editor.state);
          if (currentState?.type === 'custom' || currentState?.type === 'fieldWithCustom') {
            const tr = editor.state.tr;
            closeSuggestion(tr);
            tr.setMeta('addToHistory', false);
            editor.view.dispatch(tr);
          }
          return;
        }

        // Check displayMode to decide whether to show custom suggestions
        const displayMode = config.displayMode ?? 'replace';
        const anchorPos = editor.state.selection.from;

        if (displayMode === 'replace') {
          // Replace field suggestions with custom suggestions
          const tr = editor.state.tr;
          openCustomSuggestion(tr, suggestions, query, anchorPos);
          tr.setMeta('addToHistory', false);
          editor.view.dispatch(tr);
        } else {
          // 'prepend' or 'append' mode: combine with field suggestions
          const currentState = getSuggestionState(editor.state);

          // Get current field items (from field or fieldWithCustom state)
          const fieldItems =
            currentState?.type === 'field' || currentState?.type === 'fieldWithCustom'
              ? currentState.items
              : [];

          if (fieldItems.length > 0 || suggestions.length > 0) {
            const tr = editor.state.tr;
            openFieldWithCustomSuggestion(
              tr,
              fieldItems as FieldDefinition[],
              suggestions,
              displayMode,
              query,
              anchorPos
            );
            tr.setMeta('addToHistory', false);
            editor.view.dispatch(tr);
          }
        }
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)), {
          type: 'suggest',
          query,
        });
      }
    }, debounceMs);
  }, [editor, fields, config]);

  const loadMore = useCallback(async () => {
    if (!editor || !config?.loadMore || isLoadingMore || !hasMore) return;

    const suggestionState = getSuggestionState(editor.state);
    // Support both 'custom' and 'fieldWithCustom' types for pagination
    if (suggestionState?.type !== 'custom' && suggestionState?.type !== 'fieldWithCustom') return;

    // Capture query at start for race condition detection
    const queryAtStart = currentQueryRef.current;
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const onError = config.onError ?? defaultErrorHandler;

    setIsLoadingMore(true);

    try {
      const existingTokens = collectExistingTokens(editor);
      const maxSuggestions = config.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS;

      const loadMorePromise = config.loadMore({
        query: queryAtStart,
        fields,
        existingTokens,
        offset: currentOffsetRef.current,
        limit: maxSuggestions,
      });
      const result = await withTimeout(loadMorePromise, timeoutMs, queryAtStart);

      // Check if editor is still valid
      if (!editor || editor.isDestroyed) return;

      // Check if query changed during async operation (race condition)
      if (queryAtStart !== currentQueryRef.current) return;

      // Get current state to append to existing suggestions
      const currentState = getSuggestionState(editor.state);
      if (currentState?.type !== 'custom' && currentState?.type !== 'fieldWithCustom') return;

      const existingSuggestions = currentState.customItems;
      const newSuggestions = [...existingSuggestions, ...result.suggestions];

      // Update pagination state
      currentOffsetRef.current += result.suggestions.length;
      setHasMore(result.hasMore ?? false);

      // Update suggestion state with appended items
      const tr = editor.state.tr;
      if (currentState.type === 'custom') {
        openCustomSuggestion(tr, newSuggestions, queryAtStart, currentState.anchorPos);
      } else {
        // fieldWithCustom: preserve field items and display mode
        openFieldWithCustomSuggestion(
          tr,
          currentState.items as FieldDefinition[],
          newSuggestions,
          currentState.customDisplayMode ?? 'prepend',
          queryAtStart,
          currentState.anchorPos
        );
      }
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)), {
        type: 'loadMore',
        query: queryAtStart,
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [editor, fields, config, isLoadingMore, hasMore]);

  return { handleCustomSelect, updateCustomSuggestions, hasMore, isLoadingMore, loadMore };
}
