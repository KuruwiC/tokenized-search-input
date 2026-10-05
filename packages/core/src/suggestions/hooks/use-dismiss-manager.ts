import { useEffect, useRef } from 'react';
import type { SuggestionType } from '../../plugins/suggestion';
import { interactionBoundary } from '../interaction-boundary';

export type DismissReason = 'pointer-outside' | 'escape' | 'focus-outside';

/**
 * Closes an open suggestion on a pointer press outside it, on Escape, and, for a suggestion
 * that belongs to a token, on focus moving outside it.
 *
 * @param isInside - Whether an element is inside the suggestion's interaction boundary
 * @param onDismiss - Called with what asked for it when the suggestion should close; returns
 *   true if it did
 */
export function useDismissManager(
  isOpen: boolean,
  type: SuggestionType,
  isInside: (el: Element | null) => boolean,
  onDismiss: (reason: DismissReason) => boolean
): void {
  // A pointer press and the focus change it causes are one interaction: dismiss once.
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || type === null) {
      dismissedRef.current = false;
      return;
    }

    const safeDismiss = (reason: DismissReason) => {
      if (dismissedRef.current) return;
      if (onDismiss(reason)) dismissedRef.current = true;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!isInside(e.target as Element | null)) safeDismiss('pointer-outside');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        safeDismiss('escape');
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (!isInside(e.target as Element | null)) safeDismiss('focus-outside');
    };

    // Capture phase, so the press is handled before the focus change it causes.
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
