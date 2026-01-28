import type { RefObject } from 'react';

export type InteractionBoundary = {
  contains: (el: Element | null) => boolean;
};

export const createBoundary = (
  ...refs: Array<RefObject<HTMLElement | null>>
): InteractionBoundary => ({
  contains: (el) => !!el && refs.some((r) => r.current?.contains(el)),
});

/**
 * Create an interaction boundary that includes the suggestion overlay and
 * the token at a specific anchor position.
 *
 * Used for date/datetime pickers where:
 * - Focus should stay within the picker or the originating token
 * - Clicking another token should dismiss the picker
 *
 * Uses lazy evaluation via getter function to resolve token element at contains()
 * call time, avoiding stale DOM references when ProseMirror positions change.
 *
 * @param getTokenElement - Function that returns the current token element
 * @param suggestionRef - Ref to the suggestion overlay element
 */
export const createTokenBoundary = (
  getTokenElement: () => HTMLElement | null,
  suggestionRef: RefObject<HTMLElement | null>
): InteractionBoundary => ({
  contains: (el) => {
    if (!el) return false;

    if (suggestionRef.current?.contains(el)) return true;

    const tokenElement = getTokenElement();
    if (tokenElement?.contains(el)) return true;

    return false;
  },
});

/**
 * Create a boundary for value suggestions that only includes:
 * - The value input element itself
 * - The suggestion overlay
 *
 * Unlike createTokenBoundary, this does NOT include Operator/Delete buttons,
 * so focus on them will trigger dismiss.
 *
 * Uses lazy evaluation to avoid stale DOM references - the input element
 * is resolved at contains() call time, not at boundary creation time.
 *
 * @param getInputElement - Function that returns the current input element
 * @param suggestionRef - Ref to the suggestion overlay element
 */
export const createValueInputBoundary = (
  getInputElement: () => HTMLInputElement | null,
  suggestionRef: RefObject<HTMLElement | null>
): InteractionBoundary => ({
  contains: (el) => {
    if (!el) return false;

    if (suggestionRef.current?.contains(el)) return true;

    const inputElement = getInputElement();
    if (inputElement?.contains(el)) return true;

    return false;
  },
});
