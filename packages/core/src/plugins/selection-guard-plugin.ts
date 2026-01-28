/**
 * Selection Guard Plugin (Layer 1: Entry Guard)
 *
 * Handles keyboard events and clicks at the entry point to prevent
 * the cursor from ever being positioned at a token boundary.
 *
 * Uses the Registry + Composable pattern for declarative key handling.
 *
 * Responsibilities:
 * 1. Arrow keys: Pre-calculate next position and handle boundaries
 * 2. Delete/Backspace (single cursor): Enter token from spacer boundary
 * 3. Delete/Backspace (range selection): Expand range to include complete token+spacer units
 * 4. Click handling: Enable click on spacers to position cursor between tokens
 * 5. Focus restore: Compensate for layout changes during focus acquisition (e.g., :focus-within reflow)
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { runKeyHandlers } from '../keyboard';
import { isSpacer, isToken } from '../utils/node-predicates';
import { normalizeCursorPosition } from '../utils/normalize-cursor-position';
import { resolveSpacerClickTarget } from './selection-guard/click-resolver';
import { createDragTracker } from './selection-guard/drag-tracker';
import { type SelectionGuardState, selectionGuardKey } from './selection-guard/plugin-key';
import { handleShiftClickSelection } from './selection-guard/shift-click-handler';
import { selectionGuardKeySpecs } from './selection-guard/specs';
import { buildSelectionGuardContext } from './selection-guard/types';
import { markAsGuarded } from './selection-guard/utils';
import { setTokenFocus, tokenFocusKey } from './token-focus-plugin';
import { expandSelectionForDeletion } from './token-spacing/helpers';

export type { SelectionGuardState } from './selection-guard/plugin-key';
export { selectionGuardKey } from './selection-guard/plugin-key';

const CSS_RANGE_SELECTED = '_tsi-pm-range-selected';
const PRIMARY_MOUSE_BUTTON = 0;

type PaddingClickSide = 'left' | 'right';

/**
 * Detect if click is in padding area of the editor.
 * Returns 'left' or 'right' based on X coordinate when in padding area.
 * Returns null if click is within content area.
 */
function detectPaddingClick(view: EditorView, event: MouseEvent): PaddingClickSide | null {
  const rect = view.dom.getBoundingClientRect();
  const style = getComputedStyle(view.dom);

  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingRight = parseFloat(style.paddingRight) || 0;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;

  const contentLeft = rect.left + paddingLeft;
  const contentRight = rect.right - paddingRight;
  const contentTop = rect.top + paddingTop;
  const contentBottom = rect.bottom - paddingBottom;

  const x = event.clientX;
  const y = event.clientY;

  const inLeftPadding = x < contentLeft;
  const inRightPadding = x > contentRight;
  const inTopPadding = y < contentTop;
  const inBottomPadding = y > contentBottom;

  // Within content area
  if (!inLeftPadding && !inRightPadding && !inTopPadding && !inBottomPadding) {
    return null;
  }

  // Left/right padding: use that side directly
  if (inLeftPadding) return 'left';
  if (inRightPadding) return 'right';

  // Top/bottom padding: determine side based on X coordinate relative to center
  const contentCenter = (contentLeft + contentRight) / 2;
  return x < contentCenter ? 'left' : 'right';
}

function buildSelectionDecorationsForRanges(
  doc: ProseMirrorNode,
  ranges: readonly { $from: { pos: number }; $to: { pos: number } }[]
): DecorationSet {
  const decorations: Decoration[] = [];
  const seen = new Set<string>();

  for (const range of ranges) {
    const from = range.$from.pos;
    const to = range.$to.pos;
    if (from === to) continue;

    doc.nodesBetween(from, to, (node, pos) => {
      if (isToken(node)) {
        const nodeEnd = pos + node.nodeSize;
        if (pos < to && nodeEnd > from) {
          const key = `${pos}-${nodeEnd}`;
          if (!seen.has(key)) {
            seen.add(key);
            decorations.push(
              Decoration.node(pos, nodeEnd, {
                class: CSS_RANGE_SELECTED,
              })
            );
          }
        }
      }
      return true;
    });
  }

  return DecorationSet.create(doc, decorations);
}

/**
 * Execute spacer click from mouseup handler.
 * Does not allow spacer insertion (mousedown path).
 */
function executeSpacerClick(view: import('@tiptap/pm/view').EditorView, pos: number): void {
  const { doc } = view.state;

  const resolution = resolveSpacerClickTarget(doc, pos, null, { allowSpacerInsertion: false });
  if (!resolution) {
    return;
  }

  const { targetPos } = resolution;

  const { selection } = view.state;
  const focusState = tokenFocusKey.getState(view.state);
  const alreadyAtTarget =
    selection instanceof TextSelection &&
    selection.from === targetPos &&
    selection.to === targetPos;
  const tokenCurrentlyFocused = focusState?.focusedPos !== null;

  if (alreadyAtTarget && !tokenCurrentlyFocused) {
    if (!view.hasFocus()) {
      view.focus();
    }
    return;
  }

  const tr = view.state.tr;
  setTokenFocus(tr, { focusedPos: null });
  tr.setSelection(TextSelection.create(doc, targetPos));
  view.dispatch(markAsGuarded(tr));
  view.focus();
}

export function createSelectionGuardPlugin(): Plugin<SelectionGuardState> {
  return new Plugin<SelectionGuardState>({
    key: selectionGuardKey,

    state: {
      init() {
        return {
          decorations: DecorationSet.empty,
          editorHasFocus: true,
          isDragging: false,
          prefocusClickPos: null,
        };
      },
      apply(tr, pluginState, _oldState, newState) {
        const meta = tr.getMeta(selectionGuardKey) as
          | {
              editorHasFocus?: boolean;
              isDragging?: boolean;
              prefocusClickPos?: number | null;
            }
          | undefined;
        const editorHasFocus = meta?.editorHasFocus ?? pluginState.editorHasFocus;
        const isDragging = meta?.isDragging ?? pluginState.isDragging;
        const prefocusClickPos =
          meta?.prefocusClickPos !== undefined
            ? meta.prefocusClickPos
            : pluginState.prefocusClickPos;

        if (!editorHasFocus) {
          return {
            decorations: DecorationSet.empty,
            editorHasFocus,
            isDragging: false,
            prefocusClickPos,
          };
        }

        const focusState = tokenFocusKey.getState(newState);
        if (focusState?.focusedPos !== null) {
          return { decorations: DecorationSet.empty, editorHasFocus, isDragging, prefocusClickPos };
        }

        const sel = tr.selection;
        if (sel.empty) {
          // Keep isDragging flag even with empty selection (Firefox fix)
          // The flag is only cleared explicitly via cleanup() or blur
          return { decorations: DecorationSet.empty, editorHasFocus, isDragging, prefocusClickPos };
        }

        return {
          decorations: buildSelectionDecorationsForRanges(tr.doc, sel.ranges),
          editorHasFocus,
          isDragging,
          prefocusClickPos,
        };
      },
    },

    props: {
      decorations(state) {
        return selectionGuardKey.getState(state)?.decorations ?? DecorationSet.empty;
      },

      handleDOMEvents: {
        focus(view) {
          const pluginState = selectionGuardKey.getState(view.state);
          const prefocusClickPos = pluginState?.prefocusClickPos ?? null;

          const tr = view.state.tr;
          tr.setMeta(selectionGuardKey, { editorHasFocus: true, prefocusClickPos: null });
          view.dispatch(tr);

          // Restore cursor position after layout reflow.
          // In expandOnFocus mode, :focus-within CSS changes white-space property,
          // causing layout changes. We use the saved document position directly
          // because screen coordinates become invalid after the layout change.
          if (prefocusClickPos !== null) {
            // Skip if range selection exists (e.g., from Shift+click)
            if (!view.state.selection.empty) {
              return false;
            }

            try {
              const maxPos = view.state.doc.content.size;
              const clampedPos = Math.max(1, Math.min(prefocusClickPos, maxPos));
              const targetPos = normalizeCursorPosition(view.state.doc, clampedPos);

              const newTr = view.state.tr;
              newTr.setSelection(TextSelection.create(view.state.doc, targetPos));
              view.dispatch(markAsGuarded(newTr));
            } catch {
              // Position resolution failed - fall back to default focus behavior
            }
          }

          return false;
        },
        blur(view) {
          const { selection } = view.state;
          const tr = view.state.tr;

          // Clear range selection on blur (collapse to cursor at end)
          // This prevents selection flash on focus restore
          if (!selection.empty) {
            tr.setSelection(TextSelection.create(view.state.doc, selection.to));
          }

          tr.setMeta(selectionGuardKey, { editorHasFocus: false });
          view.dispatch(tr);
          return false;
        },
        mousedown(view, event) {
          // Block ProseMirror's default NodeSelection on token/spacer boundaries,
          // then track mouse movement to distinguish click vs drag.
          if (event.button !== PRIMARY_MOUSE_BUTTON) return false;

          const coords = { left: event.clientX, top: event.clientY };
          const posInfo = view.posAtCoords(coords);
          if (!posInfo) return false;

          // Save position before focus to restore after layout changes (e.g., expandOnFocus mode).
          // Must run before padding click check (padding detection assumes focused layout).
          if (!view.hasFocus() && !event.shiftKey) {
            const tr = view.state.tr;
            tr.setMeta(selectionGuardKey, { prefocusClickPos: posInfo.pos });
            tr.setMeta('addToHistory', false);
            view.dispatch(tr);
          }

          // Handle click in padding area: move cursor to start/end based on X coordinate.
          // Skip for Shift+click (range selection) to preserve existing behavior.
          if (!event.shiftKey) {
            const paddingSide = detectPaddingClick(view, event);
            if (paddingSide) {
              event.preventDefault();
              const { doc } = view.state;
              // Use $pos.start()/$pos.end() for safe position calculation
              const $first = doc.resolve(1);
              const targetPos = paddingSide === 'right' ? $first.end() : $first.start();
              const tr = view.state.tr;
              setTokenFocus(tr, { focusedPos: null });
              tr.setSelection(TextSelection.create(doc, targetPos));
              view.dispatch(markAsGuarded(tr));
              view.focus();
              return true;
            }
          }

          const pos = posInfo.pos;
          const { doc } = view.state;

          try {
            const $pos = doc.resolve(pos);
            const nodeBefore = $pos.nodeBefore;
            const nodeAfter = $pos.nodeAfter;

            // Handle Shift+click for range selection
            if (handleShiftClickSelection(view, event, posInfo)) {
              return true;
            }

            const beforeIsSpacer = nodeBefore && isSpacer(nodeBefore);
            const afterIsSpacer = nodeAfter && isSpacer(nodeAfter);
            const beforeIsToken = nodeBefore && isToken(nodeBefore);
            const afterIsToken = nodeAfter && isToken(nodeAfter);

            const isAtTokenBoundary =
              beforeIsSpacer || afterIsSpacer || beforeIsToken || afterIsToken;
            const isAtParagraphStart =
              !nodeBefore && $pos.parentOffset === 0 && (afterIsSpacer || afterIsToken);

            if (isAtTokenBoundary || isAtParagraphStart) {
              event.preventDefault();

              // Set isDragging immediately on mousedown (Firefox fix)
              // This prevents token-spacing plugin from focusing token during drag
              const setDraggingMeta = (isDragging: boolean) => {
                const tr = view.state.tr;
                tr.setMeta(selectionGuardKey, { isDragging });
                tr.setMeta('addToHistory', false);
                view.dispatch(tr);
              };

              setDraggingMeta(true);

              const isOnSpacer = beforeIsSpacer || afterIsSpacer;

              createDragTracker(
                {
                  startX: event.clientX,
                  startY: event.clientY,
                  posAtCoords: (coords) => view.posAtCoords(coords),
                },
                {
                  onDragStart: () => {
                    // Already set via setDraggingMeta(true) above
                  },
                  onDragMove: (movePos) => {
                    const tr = view.state.tr;
                    tr.setSelection(TextSelection.create(view.state.doc, pos, movePos));
                    tr.setMeta(selectionGuardKey, { isDragging: true });
                    view.dispatch(tr);
                  },
                  onDragEnd: (wasDrag) => {
                    // Token clicks are handled by React onClick
                    if (!wasDrag && isOnSpacer) {
                      executeSpacerClick(view, pos);
                    }
                  },
                  onCleanup: () => {
                    setDraggingMeta(false);
                  },
                }
              );

              if (!view.hasFocus()) {
                view.focus();
              }

              return true;
            }
          } catch {
            // Position resolution failed
          }

          return false;
        },
      },

      handleClick(view, pos) {
        const { doc } = view.state;
        const tr = view.state.tr;

        // Spacer clicks take priority over tokenFocus to fix Firefox race condition
        // where React's onClick sets tokenFocus before ProseMirror's handleClick runs.
        const resolution = resolveSpacerClickTarget(doc, pos, tr, { allowSpacerInsertion: true });
        if (!resolution) {
          return false;
        }

        const { targetPos, spacerInserted } = resolution;

        const { selection } = view.state;
        const focusState = tokenFocusKey.getState(view.state);
        const alreadyAtTarget =
          selection instanceof TextSelection &&
          selection.from === targetPos &&
          selection.to === targetPos;
        const tokenCurrentlyFocused = focusState?.focusedPos !== null;

        // Must dispatch if spacer was inserted, even if selection appears unchanged
        if (alreadyAtTarget && !tokenCurrentlyFocused && !spacerInserted) {
          return true;
        }

        setTokenFocus(tr, { focusedPos: null });
        // Use tr.doc after potential spacer insertion to get correct positions
        tr.setSelection(TextSelection.create(tr.doc, targetPos));
        view.dispatch(markAsGuarded(tr));

        view.focus(); // Important for Firefox

        return true;
      },

      handleKeyDown(view, event) {
        if (event.isComposing) return false;

        const focusState = tokenFocusKey.getState(view.state);

        // When token is focused, let token handle keyboard events.
        if (focusState?.focusedPos !== null) {
          return false;
        }

        const { selection } = view.state;

        if (selection instanceof TextSelection && !selection.empty) {
          if (event.key === 'Backspace' || event.key === 'Delete') {
            const expanded = expandSelectionForDeletion(
              view.state.doc,
              selection.from,
              selection.to
            );
            if (expanded) {
              event.preventDefault();
              const tr = view.state.tr;
              tr.delete(expanded.from, expanded.to);
              view.dispatch(markAsGuarded(tr));
              return true;
            }
          }
        }

        const ctx = buildSelectionGuardContext(view, event);
        return runKeyHandlers(selectionGuardKeySpecs, event.key, ctx);
      },
    },
  });
}
