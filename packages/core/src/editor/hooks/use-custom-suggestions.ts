import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { type MutableRefObject, useCallback, useEffect, useRef } from 'react';
import { getEditorContext } from '../../extensions/editor-context';
import type { TokenDisplayContent } from '../../plugins/shared/meta';
import {
  appendCustomSuggestions,
  dispatchCloseSuggestion,
  getSuggestionState,
  openCustomSuggestion,
  openFieldWithCustomSuggestion,
  setCustomLoadingMore,
} from '../../plugins/suggestion';
import { getFocusedToken } from '../../plugins/token-focus';
import { isInsideQuotes } from '../../serializer/quote-state';
import {
  canShowCustomSuggestion,
  isSuggestionDismissed,
} from '../../suggestions/suggestion-guards';
import type {
  CustomSuggestion,
  CustomSuggestionConfig,
  CustomSuggestionResult,
  ExistingToken,
  ExistingTokenWithId,
  FieldDefinition,
  SuggestedFilterToken,
  SuggestFnReturn,
  SuggestionErrorContext,
} from '../../types';
import { isFilterToken } from '../../utils/node-predicates';
import { getPlainTextSegment } from '../auto-tokenize';

function toDisplayContent(token: SuggestedFilterToken): TokenDisplayContent | undefined {
  const display: TokenDisplayContent = {};
  if (token.displayValue !== undefined) display.displayValue = token.displayValue;
  if (token.startContent != null) display.startContent = token.startContent;
  if (token.endContent != null) display.endContent = token.endContent;
  return Object.keys(display).length > 0 ? display : undefined;
}

const DEFAULT_DEBOUNCE_MS = 150;
const DEFAULT_MAX_SUGGESTIONS = 5;
const DEFAULT_TIMEOUT_MS = 5000;

const defaultErrorHandler = (error: Error, context: SuggestionErrorContext): void => {
  console.error(
    `[TokenizedSearchInput] ${context.type} failed for query "${context.query}":`,
    error
  );
};

/** The abort reason of a request that ran past `timeoutMs`; the only abort that is reported. */
class RequestTimeoutError extends Error {
  override name = 'TimeoutError';
}

/**
 * Settles with `task`, or rejects with the abort reason once the request is aborted. A
 * request still running after `timeoutMs` is abandoned like any other: it is aborted, with a
 * `RequestTimeoutError` as the reason. The timer and the listener go as soon as it settles.
 */
function withTimeout<T>(task: Promise<T>, timeoutMs: number, request: AbortController): Promise<T> {
  const { signal } = request;
  return new Promise<T>((resolve, reject) => {
    function settle(finish: () => void) {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      finish();
    }
    function onAbort() {
      settle(() => reject(signal.reason));
    }
    const timer = setTimeout(
      () =>
        request.abort(new RequestTimeoutError(`Suggestion request timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    // Handled even when the request is abandoned before it settles
    task.then(
      (value) => settle(() => resolve(value)),
      (error) => settle(() => reject(error))
    );
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Whether a failed request has something to report: it failed or timed out, rather than being
 * abandoned because the suggestions closed, a newer query started or the input unmounted.
 */
function isReportable(signal: AbortSignal): boolean {
  return !signal.aborted || signal.reason instanceof RequestTimeoutError;
}

function startRequest(ref: MutableRefObject<AbortController | null>): AbortController {
  ref.current?.abort();
  const controller = new AbortController();
  ref.current = controller;
  return controller;
}

/**
 * Takes a request that has settled out of `ref`, so that closing or unmounting later does
 * not abort a signal whose work is done.
 */
function settleRequest(
  ref: MutableRefObject<AbortController | null>,
  controller: AbortController
): void {
  if (ref.current === controller) ref.current = null;
}

/**
 * Calls `call` for `request` and waits for its result under `timeoutMs`. However it ends,
 * including a synchronous throw from `call`, the request then leaves `ref`.
 */
function runRequest<T>(
  ref: MutableRefObject<AbortController | null>,
  request: AbortController,
  timeoutMs: number,
  call: () => T | PromiseLike<T>
): Promise<T> {
  const task = new Promise<T>((resolve) => resolve(call()));
  return withTimeout(task, timeoutMs, request).finally(() => settleRequest(ref, request));
}

/**
 * Custom suggestions may show when no token is focused, the editor itself holds DOM focus
 * (a token being edited holds it instead), and the suggestion was not dismissed.
 */
function canSuggest(editor: Editor): boolean {
  return (
    canShowCustomSuggestion(editor.state) &&
    editor.isFocused &&
    !isSuggestionDismissed(editor.state)
  );
}

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
  /** Load the next page of suggestions (for infinite scroll) */
  loadMore: () => void;
}

export function useCustomSuggestions(
  editor: Editor | null,
  config: CustomSuggestionConfig | undefined
): UseCustomSuggestionsResult {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A request that was aborted has nothing to say any more.
  const suggestRequestRef = useRef<AbortController | null>(null);
  const loadMoreRequestRef = useRef<AbortController | null>(null);

  const cancelRequests = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    suggestRequestRef.current?.abort();
    suggestRequestRef.current = null;
    loadMoreRequestRef.current?.abort();
    loadMoreRequestRef.current = null;
  }, []);

  useEffect(() => cancelRequests, [cancelRequests]);

  // A suggestion that closes or is dismissed has no use for what is still on its way
  useEffect(() => {
    if (!editor) return;
    let previous = getSuggestionState(editor.state);
    const handleTransaction = () => {
      const current = getSuggestionState(editor.state);
      const closed = previous?.type != null && current?.type == null;
      const dismissed = previous?.dismissed !== true && current?.dismissed === true;
      previous = current;
      if (closed || dismissed) cancelRequests();
    };
    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor, cancelRequests]);

  const handleCustomSelect = useCallback(
    (suggestion: CustomSuggestion) => {
      if (!editor) return;

      // The text typed for the query, which follows the changes onSelect makes
      const segment = getPlainTextSegment(editor);
      let typed: { from: number; to: number } | null =
        segment.text.trim().length > 0 && segment.from >= 0 && segment.from < segment.to
          ? { from: segment.from, to: segment.to }
          : null;
      const followChanges = ({ transaction }: { transaction: Transaction }) => {
        if (!typed || !transaction.docChanged) return;
        const from = transaction.mapping.map(typed.from, 1);
        const to = transaction.mapping.map(typed.to, -1);
        typed = from < to ? { from, to } : null;
      };

      // Tokens onSelect deletes go with the rest, so that one undo brings everything back
      const doomedTokenIds: string[] = [];
      let handled = false;
      if (config?.onSelect) {
        editor.on('transaction', followChanges);
        try {
          handled = config.onSelect(suggestion, {
            existingTokens: collectExistingTokensWithId(editor),
            deleteToken: (id: string) => {
              doomedTokenIds.push(id);
            },
          });
        } finally {
          editor.off('transaction', followChanges);
        }
      }

      const ranges: Array<{ from: number; to: number }> = typed ? [typed] : [];
      editor.state.doc.descendants((node, pos) => {
        if (isFilterToken(node) && doomedTokenIds.includes(node.attrs.id)) {
          ranges.push({ from: pos, to: pos + node.nodeSize });
        }
        return true;
      });

      // Later ranges first, so that the earlier ones keep their positions
      let chain = editor.chain().focus();
      for (const range of ranges.sort((a, b) => b.from - a.from)) {
        chain = chain.deleteRange(range);
      }
      if (!handled) {
        for (const token of suggestion.tokens) {
          chain = chain.insertFilterToken({
            key: token.key,
            operator: token.operator,
            value: token.value,
            display: toDisplayContent(token),
          });
        }
      }
      chain.run();

      dispatchCloseSuggestion(editor.view);
    },
    [editor, config]
  );

  const updateCustomSuggestions = useCallback(() => {
    if (!editor || !config) return;

    if (!canSuggest(editor)) {
      cancelRequests();
      return;
    }

    const { text: plainTextSegment } = getPlainTextSegment(editor);

    if (isInsideQuotes(plainTextSegment)) {
      cancelRequests();
      return;
    }

    const query = plainTextSegment.trim();

    cancelRequests();
    const request = startRequest(suggestRequestRef);
    const { signal } = request;

    const debounceMs = config.debounceMs ?? DEFAULT_DEBOUNCE_MS;

    debounceTimerRef.current = setTimeout(async () => {
      debounceTimerRef.current = null;

      // Re-check whether a token is being edited (may have changed during debounce)
      if (getFocusedToken(editor.state) !== null) return;

      const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const onError = config.onError ?? defaultErrorHandler;

      try {
        const rawResult = await runRequest(suggestRequestRef, request, timeoutMs, () =>
          config.suggest({
            query,
            fields: getEditorContext(editor).fields,
            existingTokens: collectExistingTokens(editor),
            signal,
          })
        );

        if (signal.aborted || editor.isDestroyed || !canSuggest(editor)) return;

        const result = normalizeResult(rawResult);

        const maxSuggestions = config.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS;
        const suggestions = result.suggestions.slice(0, maxSuggestions);

        if (suggestions.length === 0) {
          // No custom suggestions - close if custom type is open, otherwise let field suggestions show
          const currentState = getSuggestionState(editor.state);
          if (currentState?.type === 'custom' || currentState?.type === 'fieldWithCustom') {
            dispatchCloseSuggestion(editor.view);
          }
          return;
        }

        const hasMore = result.hasMore ?? false;

        const displayMode = config.displayMode ?? 'replace';
        const anchorPos = editor.state.selection.from;

        if (displayMode === 'replace') {
          const tr = editor.state.tr;
          openCustomSuggestion(tr, suggestions, query, anchorPos, hasMore);
          editor.view.dispatch(tr);
        } else {
          // 'prepend' or 'append' mode: combine with field suggestions
          const currentState = getSuggestionState(editor.state);

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
              anchorPos,
              hasMore
            );
            editor.view.dispatch(tr);
          }
        }
      } catch (error) {
        if (!isReportable(signal)) return;
        onError(error instanceof Error ? error : new Error(String(error)), {
          type: 'suggest',
          query,
        });
      }
    }, debounceMs);
  }, [editor, config, cancelRequests]);

  const loadMore = useCallback(async () => {
    if (!editor || !config?.loadMore) return;

    // The pages read so far are part of the suggestion; once it closes there are none
    const started = getSuggestionState(editor.state);
    if (started?.type !== 'custom' && started?.type !== 'fieldWithCustom') return;
    if (!started.custom.hasMore || started.custom.isLoadingMore) return;

    const { query } = started;
    const { offset } = started.custom;
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const onError = config.onError ?? defaultErrorHandler;

    const request = startRequest(loadMoreRequestRef);
    const { signal } = request;
    const loading = editor.state.tr;
    setCustomLoadingMore(loading, started, true);
    editor.view.dispatch(loading);

    try {
      const { loadMore } = config;
      const result = await runRequest(loadMoreRequestRef, request, timeoutMs, () =>
        loadMore({
          query,
          fields: getEditorContext(editor).fields,
          existingTokens: collectExistingTokens(editor),
          offset,
          limit: config.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS,
          signal,
        })
      );

      // The page belongs to the suggestion that asked for it: one that closed since, or a
      // newer request, has taken that away
      const current = editor.isDestroyed ? undefined : getSuggestionState(editor.state);
      if (signal.aborted || !current?.custom.isLoadingMore) return;

      const tr = editor.state.tr;
      appendCustomSuggestions(tr, current, result.suggestions, result.hasMore ?? false);
      editor.view.dispatch(tr);
    } catch (error) {
      if (!isReportable(signal)) return;
      onError(error instanceof Error ? error : new Error(String(error)), {
        type: 'loadMore',
        query,
      });
      const current = editor.isDestroyed ? undefined : getSuggestionState(editor.state);
      if (current?.custom.isLoadingMore) {
        const tr = editor.state.tr;
        setCustomLoadingMore(tr, current, false);
        editor.view.dispatch(tr);
      }
    }
  }, [editor, config]);

  return { handleCustomSelect, updateCustomSuggestions, loadMore };
}
