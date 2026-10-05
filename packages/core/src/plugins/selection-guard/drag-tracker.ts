const DEFAULT_DRAG_THRESHOLD = 5;

export interface DragTrackerCallbacks {
  onDragStart: () => void;
  /** Called on mouse move during a drag, with the document position under the pointer */
  onDragMove: (pos: number) => void;
  /** Called when the press ends; `wasDrag` is whether the threshold was exceeded */
  onDragEnd: (wasDrag: boolean) => void;
  /**
   * Called once when tracking stops (mouseup, window blur, or button release), after
   * `onDragEnd`, so the press can still be read while its end is handled
   */
  onCleanup: () => void;
}

export interface DragTrackerConfig {
  startX: number;
  startY: number;
  /** Pixels to move before the press counts as a drag (default: 5) */
  threshold?: number;
  posAtCoords: (coords: { left: number; top: number }) => { pos: number } | null;
}

export interface DragTracker {
  cleanup: () => void;
}

/**
 * Tracks a mouse press until it ends, telling `callbacks` when it turns into a drag and
 * where the pointer is. `onCleanup` runs exactly once however the press ends.
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
    document.removeEventListener('mouseup', end);
    window.removeEventListener('blur', end);
  };

  // Every way a press ends (mouseup, window blur, a button released off-window) ends it
  // here, in the same order: the end is handled before the press is released.
  const end = () => {
    if (cleanedUp) return;
    cleanedUp = true;

    cleanupListeners();
    callbacks.onDragEnd(isDragging);
    callbacks.onCleanup();
  };

  const onMouseMove = (e: MouseEvent) => {
    // The primary button is no longer down: its mouseup went elsewhere.
    if (cleanedUp || !(e.buttons & 1)) {
      end();
      return;
    }

    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);

    if (!isDragging && (dx > threshold || dy > threshold)) {
      isDragging = true;
      callbacks.onDragStart();
    }

    if (isDragging) {
      const movePos = posAtCoords({ left: e.clientX, top: e.clientY });
      if (movePos) {
        callbacks.onDragMove(movePos.pos);
      }
    }
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', end);
  window.addEventListener('blur', end);

  return { cleanup: end };
}
