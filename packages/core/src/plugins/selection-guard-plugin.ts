/**
 * Selection Guard Plugin
 *
 * Prevents cursor from being positioned at token boundaries by handling
 * keyboard and click events at the entry point.
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

/**
 * Detect if click is in padding area of the editor.
 */
function isPaddingClick(view: EditorView, event: MouseEvent): boolean {
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

  return x < contentLeft || x > contentRight || y < contentTop || y > contentBottom;
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
              Decoration.node(pos, nodeEnd, { class: CSS_RANGE_SELECTED }, { rangeSelected: true })
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

          if (prefocusClickPos !== null) {
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

          if (!selection.empty) {
            tr.setSelection(TextSelection.create(view.state.doc, selection.to));
          }

          tr.setMeta(selectionGuardKey, { editorHasFocus: false });
          view.dispatch(tr);
          return false;
        },
        mousedown(view, event) {
          if (event.button !== PRIMARY_MOUSE_BUTTON) return false;

          const coords = { left: event.clientX, top: event.clientY };
          const posInfo = view.posAtCoords(coords);
          if (!posInfo) return false;

          if (!event.shiftKey) {
            if (isPaddingClick(view, event)) {
              event.preventDefault();
              const { doc } = view.state;
              const $first = doc.resolve(1);
              const targetPos = $first.end();
              const tr = view.state.tr;
              setTokenFocus(tr, { focusedPos: null });
              tr.setSelection(TextSelection.create(doc, targetPos));
              view.dispatch(markAsGuarded(tr));
              view.focus();
              return true;
            }
          }

          if (!view.hasFocus() && !event.shiftKey) {
            const tr = view.state.tr;
            tr.setMeta(selectionGuardKey, { prefocusClickPos: posInfo.pos });
            tr.setMeta('addToHistory', false);
            view.dispatch(tr);
          }

          const pos = posInfo.pos;
          const { doc } = view.state;

          try {
            const $pos = doc.resolve(pos);
            const nodeBefore = $pos.nodeBefore;
            const nodeAfter = $pos.nodeAfter;

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
                  onDragStart: () => {},
                  onDragMove: (movePos) => {
                    const tr = view.state.tr;
                    tr.setSelection(TextSelection.create(view.state.doc, pos, movePos));
                    tr.setMeta(selectionGuardKey, { isDragging: true });
                    view.dispatch(tr);
                  },
                  onDragEnd: (wasDrag) => {
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

        if (alreadyAtTarget && !tokenCurrentlyFocused && !spacerInserted) {
          return true;
        }

        setTokenFocus(tr, { focusedPos: null });
        tr.setSelection(TextSelection.create(tr.doc, targetPos));
        view.dispatch(markAsGuarded(tr));
        view.focus();

        return true;
      },

      handleKeyDown(view, event) {
        if (event.isComposing) return false;

        const focusState = tokenFocusKey.getState(view.state);
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
