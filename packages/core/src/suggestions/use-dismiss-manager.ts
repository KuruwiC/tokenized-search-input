import { useEffect, useRef } from 'react';
import type { SuggestionType } from '../plugins/suggestion-plugin';
import { interactionBoundary } from './suggestion-type';

/**
 * Closes an open suggestion on a pointer press outside it, on Escape, and, for a suggestion
 * that belongs to a token, on focus moving outside it.
 *
 * @param isOpen - Whether the suggestion overlay is currently open
 * @param type - The current suggestion type
 * @param isInside - Whether an element is inside the suggestion's interaction boundary
 * @param onDismiss - Called when the suggestion should close; returns true if it did
 */
export function useDismissManager(
  isOpen: boolean,
  type: SuggestionType,
  isInside: (el: Element | null) => boolean,
  onDismiss: () => boolean
): void {
  // Prevent double-dismiss when pointerdown and focusin fire for the same interaction
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || type === null) {
      dismissedRef.current = false;
      return;
    }

    const safeDismiss = () => {
      if (dismissedRef.current) return;
      // Only mark as dismissed if onDismiss actually executed the dismiss
      if (onDismiss()) dismissedRef.current = true;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!isInside(e.target as Element | null)) safeDismiss();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        safeDismiss();
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (!isInside(e.target as Element | null)) safeDismiss();
    };

    // Use capture phase for pointer events to handle before focus changes
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    const watchFocus = interactionBoundary(type) === 'value-input';
    if (watchFocus) document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      if (watchFocus) document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isOpen, type, isInside, onDismiss]);
}
