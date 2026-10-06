import type { Editor, EditorEvents } from '@tiptap/core';
import type { ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { TokenDisplay, TokenizedSearchInputRef } from '../editor/tokenized-search-input.types';
import { useIsomorphicLayoutEffect } from '../hooks/use-isomorphic-layout-effect';
import { getFocusedTokenId } from '../plugins/token-focus';
import { getApplicableDisplay, getTokenMeta } from '../plugins/token-meta-plugin';
import { findTokenById } from '../utils/find-token';
import { isFilterToken } from '../utils/node-predicates';

export interface ResolvedTokenData {
  displayValue: string;
  startContent?: ReactNode;
  endContent?: ReactNode;
  [key: string]: unknown;
}

export interface AsyncTokenResolverOptions<T> {
  /** Ref to TokenizedSearchInput */
  inputRef: RefObject<TokenizedSearchInputRef | null>;

  /** Field key to resolve (e.g., 'country') */
  fieldKey: string;

  /**
   * Fetch data for the given values.
   * Called with array of token values that need resolution.
   * @returns Array of resolved items (only for values that were found)
   */
  resolve: (values: string[]) => Promise<T[]>;

  /** Extract the original value from resolved item (for matching back to tokens) */
  getValue: (item: T) => string;

  /** Convert resolved item to display data */
  getDisplayData: (item: T) => ResolvedTokenData;

  /**
   * Content to show while loading (optional).
   * If not provided, tokens remain unchanged during loading.
   */
  loadingContent?: {
    displayValue?: string;
    startContent?: ReactNode;
  };

  /**
   * What to do when resolution fails for a token (value not found in result).
   * - 'delete': Remove the token (default)
   * - 'keep': Keep the token unchanged
   */
  onNotFound?: 'delete' | 'keep';

  /**
   * Called when the resolver rejects. The rejection is handled by the hook so
   * it is safe to pass `resolveTokens` directly to `onChange`.
   */
  onError?: (error: unknown, values: string[]) => void;
}

export interface AsyncTokenResolverResult {
  /**
   * Resolves the tokens that need it. Pass it to `onChange` or `onTokensChange`;
   * either works, and calling it from both resolves each token once.
   */
  resolveTokens: () => Promise<void>;
}

// Sentinel value to identify tokens currently being resolved
const LOADING_MARKER = '__async_resolver_loading__';

interface PendingToken {
  id: string;
  value: string;
  displayValue: string | null;
  startContent: ReactNode;
}

interface TokenView {
  key: string;
  value: string;
  displayValue: string | undefined;
  startContent: ReactNode;
  confirmed: boolean;
}

function getEditor(ref: RefObject<TokenizedSearchInputRef | null>): Editor | null {
  return ref.current?.getEditor() ?? null;
}

function toTokenDisplay(data: ResolvedTokenData): TokenDisplay {
  const display: TokenDisplay = { displayValue: data.displayValue };
  if (data.startContent !== undefined) display.startContent = data.startContent;
  if (data.endContent !== undefined) display.endContent = data.endContent;
  return display;
}

/** A token is confirmed while the user is not editing it. */
function isConfirmed(editor: Editor, id: string): boolean {
  return getFocusedTokenId(editor.state) !== id;
}

interface ReadinessSubscription {
  editor: Editor;
  unsubscribe: () => void;
}

/**
 * Calls `onMaybeReady` after a transaction that changes the document or moves focus off the
 * token being edited. Leaving a token changes no content, so `onChange` never reports it.
 */
function subscribeToReadiness(
  editor: Editor,
  onMaybeReady: () => void,
  onDestroy: () => void
): () => void {
  let focusedId = getFocusedTokenId(editor.state);
  const handleTransaction = ({ transaction }: EditorEvents['transaction']) => {
    const nextFocusedId = getFocusedTokenId(editor.state);
    const leftToken = focusedId !== null && nextFocusedId !== focusedId;
    focusedId = nextFocusedId;
    if (leftToken || !transaction.before.eq(editor.state.doc)) onMaybeReady();
  };
  editor.on('transaction', handleTransaction);
  editor.on('destroy', onDestroy);
  return () => {
    editor.off('transaction', handleTransaction);
    editor.off('destroy', onDestroy);
  };
}

function readToken(editor: Editor, id: string): TokenView | null {
  const found = findTokenById(editor.state.doc, id);
  if (!found || !isFilterToken(found.node)) return null;
  const { key, value } = found.node.attrs;
  const display = getApplicableDisplay(getTokenMeta(editor.state, id)?.display, key, value);
  return {
    key,
    value,
    displayValue: display?.displayValue,
    startContent: display?.startContent ?? null,
    confirmed: isConfirmed(editor, id),
  };
}

function collectPendingTokens(editor: Editor, fieldKey: string): PendingToken[] {
  const tokens: PendingToken[] = [];

  editor.state.doc.descendants((node) => {
    if (!isFilterToken(node)) return true;
    const { id, key, value } = node.attrs;
    if (
      key === fieldKey &&
      typeof id === 'string' &&
      id.length > 0 &&
      value &&
      !getApplicableDisplay(getTokenMeta(editor.state, id)?.display, key, value)?.displayValue &&
      isConfirmed(editor, id)
    ) {
      tokens.push({ id, value, displayValue: null, startContent: null });
    }
    return false;
  });

  return tokens;
}

/**
 * Hook for resolving displayValue asynchronously for pasted/deserialized tokens.
 *
 * When tokens are created from pasted text or deserialization, they often only have
 * a `value` but no `displayValue`. This hook provides a convenient way to:
 * 1. Detect tokens needing resolution (no displayValue, and not being edited)
 * 2. Optionally show a loading state
 * 3. Fetch the display data asynchronously
 * 4. Update the tokens with resolved display data
 * 5. Handle tokens that couldn't be resolved (delete or keep)
 *
 * **Important**: Only tokens the user is not editing are resolved. Tokens being edited
 * (where the user is still typing) are skipped until the user exits the token (blur/Tab/Enter).
 * This prevents display updates during editing which would disrupt the user's input.
 *
 * @example
 * ```typescript
 * const { resolveTokens } = useAsyncTokenResolver({
 *   inputRef,
 *   fieldKey: 'country',
 *   resolve: async (values) => {
 *     const { countries } = await fetchCountries({ values });
 *     return countries;
 *   },
 *   getValue: (c) => c.value,
 *   getDisplayData: (c) => ({
 *     displayValue: c.label,
 *     startContent: <span>{c.emoji}</span>,
 *   }),
 *   loadingContent: {
 *     displayValue: 'Loading...',
 *     startContent: <Loader2 className="animate-spin" />,
 *   },
 * });
 *
 * // Use in onChange (or onTokensChange)
 * <TokenizedSearchInput ref={inputRef} onChange={resolveTokens} />
 * ```
 */
export function useAsyncTokenResolver<T>(
  options: AsyncTokenResolverOptions<T>
): AsyncTokenResolverResult {
  const {
    inputRef,
    fieldKey,
    resolve,
    getValue,
    getDisplayData,
    loadingContent,
    onNotFound = 'delete',
    onError,
  } = options;

  const activeResolutionRef = useRef<Promise<void> | null>(null);
  const rerunRequestedRef = useRef(false);
  const applyingResultRef = useRef(false);
  const subscriptionRef = useRef<ReadinessSubscription | null>(null);
  const latestResolveTokensRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const stopFollowing = useCallback(() => {
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
  }, []);

  // The ref gives no notice when the editor is created or replaced, so the editor is
  // followed on each render and each resolveTokens call. A token appears only through a
  // document change, which reaches resolveTokens first, so no token is left unfollowed.
  const followEditor = useCallback(
    (editor: Editor | null) => {
      if (subscriptionRef.current?.editor === editor) return;
      stopFollowing();
      if (!editor || editor.isDestroyed) return;
      subscriptionRef.current = {
        editor,
        unsubscribe: subscribeToReadiness(
          editor,
          () => {
            void latestResolveTokensRef.current();
          },
          stopFollowing
        ),
      };
    },
    [stopFollowing]
  );

  const resolveTokens = useCallback((): Promise<void> => {
    // Transactions created by this hook can synchronously invoke onChange.
    // They are not new work and must not schedule another resolver pass.
    if (applyingResultRef.current) return Promise.resolve();

    followEditor(getEditor(inputRef));

    if (activeResolutionRef.current) {
      rerunRequestedRef.current = true;
      return activeResolutionRef.current;
    }

    const run = async () => {
      let shouldContinue = true;
      const failedTokenIds = new Set<string>();

      while (shouldContinue) {
        rerunRequestedRef.current = false;

        const editor = getEditor(inputRef);
        if (!editor || editor.isDestroyed) return;

        const tokensToResolve = collectPendingTokens(editor, fieldKey).filter(
          (token) => !failedTokenIds.has(token.id)
        );
        if (tokensToResolve.length === 0) {
          shouldContinue = rerunRequestedRef.current;
          continue;
        }

        const loadingDisplayValue = loadingContent?.displayValue ?? LOADING_MARKER;

        if (loadingContent) {
          applyingResultRef.current = true;
          try {
            for (const token of tokensToResolve) {
              const current = readToken(editor, token.id);
              if (current?.value === token.value && !current.displayValue) {
                inputRef.current?.setTokenDisplay(token.id, {
                  displayValue: loadingDisplayValue,
                  startContent: loadingContent.startContent ?? null,
                });
              }
            }
          } finally {
            applyingResultRef.current = false;
          }
        }

        const values = [...new Set(tokensToResolve.map((token) => token.value))];
        let resolvedItems: T[];

        try {
          resolvedItems = await resolve(values);
        } catch (error) {
          const currentEditor = getEditor(inputRef);
          if (loadingContent && currentEditor === editor && !editor.isDestroyed) {
            applyingResultRef.current = true;
            try {
              for (const token of tokensToResolve) {
                const current = readToken(editor, token.id);
                if (
                  current?.key === fieldKey &&
                  current.value === token.value &&
                  current.displayValue === loadingDisplayValue
                ) {
                  inputRef.current?.setTokenDisplay(token.id, {
                    displayValue: token.displayValue,
                    startContent: token.startContent,
                  });
                }
              }
            } finally {
              applyingResultRef.current = false;
            }
          }
          for (const token of tokensToResolve) {
            failedTokenIds.add(token.id);
          }
          onError?.(error, values);
          shouldContinue = rerunRequestedRef.current;
          continue;
        }

        const currentEditor = getEditor(inputRef);
        if (currentEditor !== editor || editor.isDestroyed) return;

        const itemMap = new Map(resolvedItems.map((item) => [getValue(item), item]));
        const toUpdate: { id: string; display: TokenDisplay }[] = [];
        const toDelete: string[] = [];

        for (const token of tokensToResolve) {
          const current = readToken(editor, token.id);
          const stillPending =
            current?.key === fieldKey &&
            current.value === token.value &&
            current.confirmed &&
            (loadingContent ? current.displayValue === loadingDisplayValue : !current.displayValue);

          if (!stillPending) continue;

          const item = itemMap.get(token.value);
          if (item) {
            toUpdate.push({ id: token.id, display: toTokenDisplay(getDisplayData(item)) });
          } else if (onNotFound === 'delete') {
            toDelete.push(token.id);
          } else {
            toUpdate.push({ id: token.id, display: { displayValue: token.value } });
          }
        }

        applyingResultRef.current = true;
        try {
          for (const { id, display } of toUpdate) {
            inputRef.current?.setTokenDisplay(id, display);
          }
          for (const id of toDelete) {
            inputRef.current?.deleteToken(id);
          }
        } finally {
          applyingResultRef.current = false;
        }

        shouldContinue = rerunRequestedRef.current;
      }
    };

    // Start on the next microtask so the shared promise is visible before any
    // editor update can synchronously call resolveTokens again.
    let activeResolution: Promise<void>;
    activeResolution = Promise.resolve()
      .then(run)
      .finally(() => {
        if (activeResolutionRef.current === activeResolution) {
          activeResolutionRef.current = null;
        }
      });
    activeResolutionRef.current = activeResolution;
    return activeResolution;
  }, [
    inputRef,
    fieldKey,
    resolve,
    getValue,
    getDisplayData,
    loadingContent,
    onNotFound,
    onError,
    followEditor,
  ]);

  useIsomorphicLayoutEffect(() => {
    latestResolveTokensRef.current = resolveTokens;
  });

  useEffect(() => {
    followEditor(getEditor(inputRef));
  });

  useEffect(() => stopFollowing, [stopFollowing]);

  return { resolveTokens };
}
