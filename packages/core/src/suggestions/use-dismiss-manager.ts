import { useEffect, useRef } from 'react';
import type { SuggestionType } from '../plugins/suggestion-plugin';
import { type DismissReason, getDismissPolicy, shouldDismiss } from './dismiss-policy';
import type { InteractionBoundary } from './interaction-boundary';

/**
 * Manages dismissal of suggestion overlays via outside clicks, escape key, and focus changes.
 *
 * This hook centralizes dismiss logic that was previously scattered across
 * multiple event handlers. It uses the DismissPolicy pattern to determine
 * whether each dismiss reason should trigger dismissal for the current
 * suggestion type.
 *
 * @param isOpen - Whether the suggestion overlay is currently open
 * @param type - The current suggestion type (field, value, date, datetime)
 * @param boundary - The interaction boundary defining "inside" elements
 * @param onDismiss - Callback when dismissal should occur. Returns true if dismiss was executed.
 */
export function useDismissManager(
  isOpen: boolean,
  type: SuggestionType,
  boundary: InteractionBoundary,
  onDismiss: (reason: DismissReason) => boolean
): void {
  // Prevent double-dismiss when pointerdown and focusin fire for the same interaction
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || type === null) {
      dismissedRef.current = false;
      return;
    }

    const policy = getDismissPolicy(type);

    const safeDismiss = (reason: DismissReason) => {
      if (dismissedRef.current) return;
      // Only mark as dismissed if onDismiss actually executed the dismiss
      const didDismiss = onDismiss(reason);
      if (didDismiss) {
        dismissedRef.current = true;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!boundary.contains(target) && shouldDismiss(policy, 'pointer-outside')) {
        safeDismiss('pointer-outside');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && shouldDismiss(policy, 'escape')) {
        e.preventDefault();
        safeDismiss('escape');
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (!shouldDismiss(policy, 'focus-outside')) return;

      const target = e.target as Element | null;
      if (!boundary.contains(target)) {
        safeDismiss('focus-outside');
      }
    };

    // Use capture phase for pointer events to handle before focus changes
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    if (shouldDismiss(policy, 'focus-outside')) {
      document.addEventListener('focusin', handleFocusIn);
    }

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isOpen, type, boundary, onDismiss]);
}
