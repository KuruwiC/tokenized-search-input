/**
 * Drag Tracker
 *
 * Manages mouse drag tracking for selection operations.
 * Handles DOM event listeners and threshold detection,
 * delegating ProseMirror operations via callbacks.
 */

const DEFAULT_DRAG_THRESHOLD = 5;

export interface DragTrackerCallbacks {
  /** Called when drag threshold is exceeded */
  onDragStart: () => void;
  /** Called on mouse move during drag with document position */
  onDragMove: (pos: number) => void;
  /** Called when drag ends (mouseup). wasDrag indicates if threshold was exceeded */
  onDragEnd: (wasDrag: boolean) => void;
  /** Called during cleanup (blur, mouseup, or button release) */
  onCleanup: () => void;
}

export interface DragTrackerConfig {
  /** Starting X coordinate */
  startX: number;
  /** Starting Y coordinate */
  startY: number;
  /** Pixels to move before considered a drag (default: 5) */
  threshold?: number;
  /** Function to convert screen coords to document position */
  posAtCoords: (coords: { left: number; top: number }) => { pos: number } | null;
}

export interface DragTracker {
  /** Call to cleanup listeners and state */
  cleanup: () => void;
}

/**
 * Create a drag tracker that manages mouse tracking for drag selection.
 *
 * The tracker:
 * - Listens to mousemove, mouseup, and window blur events
 * - Detects when drag threshold is exceeded
 * - Converts screen coordinates to document positions
 * - Ensures cleanup is called exactly once
 *
 * @param config - Configuration including start position and posAtCoords function
 * @param callbacks - Event callbacks for drag lifecycle
 * @returns Object with cleanup function
 */
export function createDragTracker(
  config: DragTrackerConfig,
  callbacks: DragTrackerCallbacks
): DragTracker {
  const { startX, startY, threshold = DEFAULT_DRAG_THRESHOLD, posAtCoords } = config;

  let isDragging = false;
  let cleanedUp = false;

  const cleanupListeners = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('blur', onWindowBlur);
  };

  const cleanup = (fromMouseUp: boolean) => {
    if (cleanedUp) return;
    cleanedUp = true;

    cleanupListeners();

    // Call onDragEnd if cleanup triggered by non-mouseup event (blur, button release)
    // This ensures spacer clicks are handled even when mouse released off-window
    if (!fromMouseUp) {
      callbacks.onDragEnd(isDragging);
    }

    callbacks.onCleanup();
  };

  const onMouseMove = (e: MouseEvent) => {
    // Cleanup if button was released (e.g., focus lost to another window)
    if (cleanedUp || !(e.buttons & 1)) {
      cleanup(false);
      return;
    }

    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);

    // Check if drag threshold exceeded
    if (!isDragging && (dx > threshold || dy > threshold)) {
      isDragging = true;
      callbacks.onDragStart();
    }

    // Update selection during drag
    if (isDragging) {
      const movePos = posAtCoords({ left: e.clientX, top: e.clientY });
      if (movePos) {
        callbacks.onDragMove(movePos.pos);
      }
    }
  };

  const onMouseUp = () => {
    const wasDrag = isDragging;
    cleanup(true);
    callbacks.onDragEnd(wasDrag);
  };

  const onWindowBlur = () => {
    cleanup(false);
  };

  // Attach listeners
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onWindowBlur);

  return { cleanup: () => cleanup(false) };
}
