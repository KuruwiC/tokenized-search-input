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
}

export interface AsyncTokenResolverResult {
  /** Call this to trigger resolution (typically in onChange callback) */
  resolveTokens: () => Promise<void>;
}

// Sentinel value to identify tokens currently being resolved
const LOADING_MARKER = '__async_resolver_loading__';

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
  } = options;

  // Track in-flight resolutions to prevent duplicate calls
  const resolvingRef = useRef(false);

  const resolveTokens = useCallback(async () => {
    const editor = getEditor(inputRef.current);
    if (!editor) return;

    if (resolvingRef.current) return;

    const tokensToResolve: { pos: number; value: string }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (
        node.type.name === 'filterToken' &&
        node.attrs.key === fieldKey &&
        node.attrs.value &&
        !node.attrs.displayValue &&
        node.attrs.confirmed === true
      ) {
        tokensToResolve.push({ pos, value: node.attrs.value });
      }
      return true;
    });

    if (tokensToResolve.length === 0) return;

    resolvingRef.current = true;

    try {
      if (loadingContent) {
        const tr = editor.state.tr;
        for (const { pos } of tokensToResolve) {
          updateTokenAttrs(tr, pos, {
            displayValue: loadingContent.displayValue ?? LOADING_MARKER,
            startContent: loadingContent.startContent,
          });
        }
        editor.view.dispatch(tr);
      }

      const values = tokensToResolve.map((t) => t.value);
      const resolvedItems = await resolve(values);
      const itemMap = new Map(resolvedItems.map((item) => [getValue(item), item]));

      // Re-collect token positions (may have shifted during async operation)
      const loadingDisplayValue = loadingContent?.displayValue ?? LOADING_MARKER;
      const currentTokens: { pos: number; value: string }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (
          node.type.name === 'filterToken' &&
          node.attrs.key === fieldKey &&
          node.attrs.value &&
          (loadingContent
            ? node.attrs.displayValue === loadingDisplayValue
            : !node.attrs.displayValue)
        ) {
          currentTokens.push({ pos, value: node.attrs.value });
        }
        return true;
      });

      const toUpdate: { pos: number; data: ResolvedTokenData }[] = [];
      const toDelete: { pos: number; nodeSize: number }[] = [];

      for (const { pos, value } of currentTokens) {
        const item = itemMap.get(value);
        if (item) {
          toUpdate.push({ pos, data: getDisplayData(item) });
        } else if (onNotFound === 'delete') {
          const node = editor.state.doc.nodeAt(pos);
          if (node) {
            toDelete.push({ pos, nodeSize: node.nodeSize });
          }
        } else {
          // onNotFound === 'keep': clear loading state, use value as displayValue
          toUpdate.push({ pos, data: { displayValue: value } });
        }
      }

      // Apply updates (display-only change, excluded from history)
      if (toUpdate.length > 0) {
        const tr = editor.state.tr;
        for (const { pos, data } of toUpdate) {
          updateTokenAttrs(tr, pos, data);
        }
        editor.view.dispatch(tr);
      }

      // Apply deletions (process in reverse order to maintain positions)
      const sortedDeletes = [...toDelete].sort((a, b) => b.pos - a.pos);
      for (const { pos, nodeSize } of sortedDeletes) {
        editor
          .chain()
          .deleteRange({ from: pos, to: pos + nodeSize })
          .run();
      }
    } finally {
      resolvingRef.current = false;
    }
  }, [inputRef, fieldKey, resolve, getValue, getDisplayData, loadingContent, onNotFound]);

  return { resolveTokens };
}
