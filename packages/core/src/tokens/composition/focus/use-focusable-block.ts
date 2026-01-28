import type { RefObject } from 'react';
import { useLayoutEffect } from 'react';
import { type CursorPosition, useTokenFocusContext } from '../contexts';

export interface UseFocusableBlockOptions {
  id: string;
  ref: RefObject<HTMLElement | null>;
  focus?: (position?: CursorPosition) => void;
  /** Whether this element is available for focus navigation. Default: true */
  available?: boolean;
  /** Whether this element can receive focus when entering the token via Backspace/Delete. Default: true */
  entryFocusable?: boolean;
}

export interface UseFocusableBlockResult {
  /** Navigate to previous element (all elements, for Arrow navigation) */
  navigateLeft: () => void;
  /** Navigate to next element (all elements, for Arrow navigation). Optionally specify cursor position. */
  navigateRight: (position?: CursorPosition) => void;
  /** Navigate to previous entryFocusable element (for Backspace/Delete navigation) */
  navigateLeftEntry: () => void;
  /** Navigate to next entryFocusable element (for Backspace/Delete navigation) */
  navigateRightEntry: () => void;
  tabIndex: 0 | -1;
  /** Call this in onFocus handler to sync focus state */
  handleFocus: () => void;
}

/**
 * Hook for registering a focusable block within a Token.
 * Handles automatic registration/unregistration and provides navigation helpers.
 */
export function useFocusableBlock(options: UseFocusableBlockOptions): UseFocusableBlockResult {
  const { id, ref, focus, available = true, entryFocusable } = options;
  const { focusRegistry, currentFocusId, setCurrentFocusId } = useTokenFocusContext();

  useLayoutEffect(() => {
    if (!available) return;

    const defaultFocus = (position?: CursorPosition) => {
      const element = ref.current;
      if (!element) return;

      if (element instanceof HTMLInputElement) {
        element.focus();
        if (position === 'start') {
          element.setSelectionRange(0, 0);
        } else if (position === 'end') {
          element.setSelectionRange(element.value.length, element.value.length);
        }
      } else {
        element.focus();
      }
    };

    const wrappedFocus = (position?: CursorPosition) => {
      (focus ?? defaultFocus)(position);
      setCurrentFocusId(id);
    };

    const unregister = focusRegistry.register({
      id,
      ref,
      focus: wrappedFocus,
      entryFocusable,
    });

    return unregister;
  }, [id, ref, focus, available, entryFocusable, focusRegistry, setCurrentFocusId]);

  const navigateLeft = () => focusRegistry.focusPrev(id);
  const navigateRight = (position?: CursorPosition) => focusRegistry.focusNext(id, position);
  const navigateLeftEntry = () => focusRegistry.focusPrevEntryFocusable(id);
  const navigateRightEntry = () => focusRegistry.focusNextEntryFocusable(id);
  const handleFocus = () => setCurrentFocusId(id);

  const tabIndex = currentFocusId === id ? 0 : -1;

  return {
    navigateLeft,
    navigateRight,
    navigateLeftEntry,
    navigateRightEntry,
    tabIndex,
    handleFocus,
  };
}
