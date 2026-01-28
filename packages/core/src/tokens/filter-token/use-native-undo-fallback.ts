import { useEffect, useRef } from 'react';

// Native undo events fire synchronously within the same event loop.
// 50ms provides margin for any potential async scheduling.
const NATIVE_UNDO_DETECTION_TIMEOUT_MS = 50;

// Type guard for InputEvent
function isInputEvent(evt: Event): evt is InputEvent {
  return 'inputType' in evt;
}

interface UseNativeUndoFallbackOptions {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFallback: () => void;
  enabled: boolean;
}

/**
 * Detects when browser's native undo has no history and triggers a fallback action.
 *
 * When Cmd+Z is pressed on an empty input, the browser may have undo history
 * (e.g., user typed and deleted text) or no history (newly created input).
 * This hook waits for the native undo result via InputEvent.inputType === 'historyUndo'.
 * If no undo event fires within a short window, the fallback is triggered.
 */
export function useNativeUndoFallback({
  inputRef,
  onFallback,
  enabled,
}: UseNativeUndoFallbackOptions) {
  const undoFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoInputListenerRef = useRef<((evt: Event) => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (undoFallbackTimeoutRef.current) {
        clearTimeout(undoFallbackTimeoutRef.current);
      }
      const input = inputRef.current;
      if (input && undoInputListenerRef.current) {
        input.removeEventListener('input', undoInputListenerRef.current);
      }
    };
  }, [inputRef]);

  const handleUndoKeyDown = (e: React.KeyboardEvent): boolean => {
    if (!enabled) return false;
    if (!e.metaKey && !e.ctrlKey) return false;
    if (e.shiftKey) return false; // Don't intercept Redo

    const input = inputRef.current;
    if (!input) return false;

    // Cleanup any existing pending check to handle rapid consecutive presses
    if (undoInputListenerRef.current) {
      input.removeEventListener('input', undoInputListenerRef.current);
    }
    if (undoFallbackTimeoutRef.current) {
      clearTimeout(undoFallbackTimeoutRef.current);
    }

    const handleHistoryUndo = (evt: Event) => {
      if (isInputEvent(evt) && evt.inputType === 'historyUndo') {
        // Native undo succeeded - cancel fallback
        if (undoFallbackTimeoutRef.current) {
          clearTimeout(undoFallbackTimeoutRef.current);
          undoFallbackTimeoutRef.current = null;
        }
        input.removeEventListener('input', handleHistoryUndo);
        undoInputListenerRef.current = null;
      }
    };

    undoInputListenerRef.current = handleHistoryUndo;
    input.addEventListener('input', handleHistoryUndo);

    // If no historyUndo event fires, browser had no undo history
    undoFallbackTimeoutRef.current = setTimeout(() => {
      input.removeEventListener('input', handleHistoryUndo);
      undoInputListenerRef.current = null;
      undoFallbackTimeoutRef.current = null;
      if (input.value === '') {
        onFallback();
      }
    }, NATIVE_UNDO_DETECTION_TIMEOUT_MS);

    return false; // Don't prevent default - let browser try undo
  };

  return { handleUndoKeyDown };
}
