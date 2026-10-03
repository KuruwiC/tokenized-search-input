const DEFAULT_DRAG_THRESHOLD = 5;

export interface DragTrackerCallbacks {
  /** Called when the drag threshold is exceeded */
  onDragStart: () => void;
  /** Called on mouse move during a drag, with the document position under the pointer */
  onDragMove: (pos: number) => void;
  /** Called when the press ends; `wasDrag` is whether the threshold was exceeded */
  onDragEnd: (wasDrag: boolean) => void;
  /** Called once when tracking stops (mouseup, window blur, or button release) */
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
    document.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('blur', onWindowBlur);
  };

  const cleanup = (fromMouseUp: boolean) => {
    if (cleanedUp) return;
    cleanedUp = true;

    cleanupListeners();

    // A press that ends without a mouseup (blur, button released off-window) still ends
    // here, so a click next to a token is handled.
    if (!fromMouseUp) {
      callbacks.onDragEnd(isDragging);
    }

    callbacks.onCleanup();
  };

  const onMouseMove = (e: MouseEvent) => {
    // The primary button is no longer down: its mouseup went elsewhere.
    if (cleanedUp || !(e.buttons & 1)) {
      cleanup(false);
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

  const onMouseUp = () => {
    const wasDrag = isDragging;
    cleanup(true);
    callbacks.onDragEnd(wasDrag);
  };

  const onWindowBlur = () => {
    cleanup(false);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onWindowBlur);

  return { cleanup: () => cleanup(false) };
}
