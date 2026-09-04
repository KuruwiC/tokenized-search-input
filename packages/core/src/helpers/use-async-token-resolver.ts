import type { Editor } from '@tiptap/core';
import type { ReactNode, RefObject } from 'react';
import { useCallback, useRef } from 'react';
import type { TokenizedSearchInputRef } from '../editor/tokenized-search-input';
import { updateTokenAttrs } from '../utils/token-attrs';

/**
 * Extended ref interface that includes internal editor access.
 */
interface TokenizedSearchInputRefWithEditor extends TokenizedSearchInputRef {
  _getInternalEditor: () => Editor | null;
}

function getEditor(ref: TokenizedSearchInputRef | null): Editor | null {
  if (!ref) return null;
  const refWithEditor = ref as TokenizedSearchInputRefWithEditor;
  if (typeof refWithEditor._getInternalEditor === 'function') {
    return refWithEditor._getInternalEditor();
  }
  return null;
}

export interface ResolvedTokenData {
  displayValue: string;
  startContent?: ReactNode;
  endContent?: ReactNode;
  [key: string]: unknown;
}

export interface AsyncTokenResolverOptions<T> {
  /** Ref to TokenizedSearchInput */
  inputRef: RefObject<TokenizedSearchInputRef>;

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
  /** Call this to trigger resolution (typically in onChange callback) */
  resolveTokens: () => Promise<void>;
}

// Sentinel value to identify tokens currently being resolved
const LOADING_MARKER = '__async_resolver_loading__';

interface PendingToken {
  id: string;
  value: string;
  displayValue: unknown;
  startContent: unknown;
}

function collectPendingTokens(editor: Editor, fieldKey: string): PendingToken[] {
  const tokens: PendingToken[] = [];

  editor.state.doc.descendants((node) => {
    if (
      node.type.name === 'filterToken' &&
      node.attrs.key === fieldKey &&
      typeof node.attrs.id === 'string' &&
      node.attrs.id.length > 0 &&
      node.attrs.value &&
      !node.attrs.displayValue &&
      node.attrs.confirmed === true
    ) {
      tokens.push({
        id: node.attrs.id,
        value: node.attrs.value,
        displayValue: node.attrs.displayValue,
        startContent: node.attrs.startContent,
      });
    }
    return true;
  });

  return tokens;
}

function findTokenById(editor: Editor, id: string): { pos: number; nodeSize: number } | null {
  let match: { pos: number; nodeSize: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'filterToken' && node.attrs.id === id) {
      match = { pos, nodeSize: node.nodeSize };
      return false;
    }
    return true;
  });
  return match;
}

/**
 * Hook for resolving displayValue asynchronously for pasted/deserialized tokens.
 *
 * When tokens are created from pasted text or deserialization, they often only have
 * a `value` but no `displayValue`. This hook provides a convenient way to:
 * 1. Detect tokens needing resolution (where displayValue is not set AND confirmed is true)
 * 2. Optionally show a loading state
 * 3. Fetch the display data asynchronously
 * 4. Update the tokens with resolved display data
 * 5. Handle tokens that couldn't be resolved (delete or keep)
 *
 * **Important**: Only tokens with `confirmed: true` are resolved. Tokens being edited
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
 * // Use in onChange
 * <TokenizedSearchInput onChange={resolveTokens} />
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

  const resolveTokens = useCallback((): Promise<void> => {
    // Transactions created by this hook can synchronously invoke onChange.
    // They are not new work and must not schedule another resolver pass.
    if (applyingResultRef.current) return Promise.resolve();

    if (activeResolutionRef.current) {
      rerunRequestedRef.current = true;
      return activeResolutionRef.current;
    }

    const run = async () => {
      let shouldContinue = true;
      const failedTokenIds = new Set<string>();

      while (shouldContinue) {
        rerunRequestedRef.current = false;

        const editor = getEditor(inputRef.current);
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
          const tr = editor.state.tr;
          for (const token of tokensToResolve) {
            const current = findTokenById(editor, token.id);
            const node = current ? tr.doc.nodeAt(current.pos) : null;
            if (current && node?.attrs.value === token.value && !node.attrs.displayValue) {
              updateTokenAttrs(tr, current.pos, {
                displayValue: loadingDisplayValue,
                startContent: loadingContent.startContent,
              });
            }
          }
          if (tr.docChanged) {
            applyingResultRef.current = true;
            try {
              editor.view.dispatch(tr);
            } finally {
              applyingResultRef.current = false;
            }
          }
        }

        const values = [...new Set(tokensToResolve.map((token) => token.value))];
        let resolvedItems: T[];

        try {
          resolvedItems = await resolve(values);
        } catch (error) {
          const currentEditor = getEditor(inputRef.current);
          if (loadingContent && currentEditor === editor && !editor.isDestroyed) {
            const tr = editor.state.tr;
            for (const token of tokensToResolve) {
              const current = findTokenById(editor, token.id);
              const node = current ? tr.doc.nodeAt(current.pos) : null;
              if (
                current &&
                node?.attrs.key === fieldKey &&
                node.attrs.value === token.value &&
                node.attrs.displayValue === loadingDisplayValue
              ) {
                updateTokenAttrs(tr, current.pos, {
                  displayValue: token.displayValue,
                  startContent: token.startContent,
                });
              }
            }
            if (tr.docChanged) {
              applyingResultRef.current = true;
              try {
                editor.view.dispatch(tr);
              } finally {
                applyingResultRef.current = false;
              }
            }
          }
          for (const token of tokensToResolve) {
            failedTokenIds.add(token.id);
          }
          onError?.(error, values);
          shouldContinue = rerunRequestedRef.current;
          continue;
        }

        const currentEditor = getEditor(inputRef.current);
        if (currentEditor !== editor || editor.isDestroyed) return;

        const itemMap = new Map(resolvedItems.map((item) => [getValue(item), item]));
        const toUpdate: { pos: number; data: ResolvedTokenData }[] = [];
        const toDelete: { pos: number; nodeSize: number }[] = [];

        for (const token of tokensToResolve) {
          const current = findTokenById(editor, token.id);
          const node = current ? editor.state.doc.nodeAt(current.pos) : null;
          const stillPending =
            node?.attrs.key === fieldKey &&
            node.attrs.value === token.value &&
            node.attrs.confirmed === true &&
            (loadingContent
              ? node.attrs.displayValue === loadingDisplayValue
              : !node.attrs.displayValue);

          if (!current || !node || !stillPending) continue;

          const item = itemMap.get(token.value);
          if (item) {
            toUpdate.push({ pos: current.pos, data: getDisplayData(item) });
          } else if (onNotFound === 'delete') {
            toDelete.push(current);
          } else {
            toUpdate.push({ pos: current.pos, data: { displayValue: token.value } });
          }
        }

        applyingResultRef.current = true;
        try {
          if (toUpdate.length > 0) {
            const tr = editor.state.tr;
            for (const { pos, data } of toUpdate) {
              updateTokenAttrs(tr, pos, data);
            }
            editor.view.dispatch(tr);
          }

          if (toDelete.length > 0) {
            const tr = editor.state.tr;
            for (const { pos, nodeSize } of [...toDelete].sort((a, b) => b.pos - a.pos)) {
              tr.delete(pos, pos + nodeSize);
            }
            editor.view.dispatch(tr);
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
  }, [inputRef, fieldKey, resolve, getValue, getDisplayData, loadingContent, onNotFound, onError]);

  return { resolveTokens };
}
