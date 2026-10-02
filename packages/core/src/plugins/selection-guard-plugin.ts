/**
 * Selection Guard Plugin
 *
 * Handles the pointer and keyboard input around tokens that the browser would get
 * wrong on its own: a press next to a token puts the caret where it landed or starts a
 * drag selection from there, Shift+click and Shift+Arrow select whole tokens, and the
 * arrow keys and Backspace/Delete enter the token beside the caret.
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { runKeyHandlers } from '../keyboard';
import { nearestValidCaret } from '../utils/caret';
import { isToken } from '../utils/node-predicates';
import { createDragTracker } from './selection-guard/drag-tracker';
import { type SelectionGuardState, selectionGuardKey } from './selection-guard/plugin-key';
import { handleShiftClickSelection } from './selection-guard/shift-click-handler';
import { selectionGuardKeySpecs } from './selection-guard/specs';
import { buildSelectionGuardContext } from './selection-guard/types';
import { markAsGuarded } from './selection-guard/utils';
import { setTokenFocus, tokenFocusKey } from './token-focus-plugin';

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

function isTokenNode(node: ProseMirrorNode | null | undefined): boolean {
  return node != null && isToken(node);
}

function setPress(view: EditorView, pressPos: number | null): void {
  const tr = view.state.tr;
  tr.setMeta(selectionGuardKey, { pressPos });
  tr.setMeta('addToHistory', false);
  view.dispatch(tr);
}

/** Puts the caret where a press that did not become a drag started. */
function placeCaretAtPress(view: EditorView): void {
  const pressPos = selectionGuardKey.getState(view.state)?.pressPos;
  if (pressPos == null) return;
  const tr = view.state.tr;
  setTokenFocus(tr, { focusedPos: null });
  tr.setSelection(TextSelection.create(tr.doc, nearestValidCaret(tr.doc, pressPos, 1)));
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
          pressPos: null,
          prefocusClickPos: null,
        };
      },
      apply(tr, pluginState, _oldState, newState) {
        const meta = tr.getMeta(selectionGuardKey) as
          | {
              editorHasFocus?: boolean;
              pressPos?: number | null;
              prefocusClickPos?: number | null;
            }
          | undefined;
        const editorHasFocus = meta?.editorHasFocus ?? pluginState.editorHasFocus;
        // Positions captured at a press follow the edits made while the press lasts.
        const mapped = (pos: number | null) => (pos === null ? null : tr.mapping.map(pos));
        // A press lasts from mousedown until its tracker cleans up, whatever happens to
        // focus in between: the press itself may be what gives the editor focus.
        const pressPos =
          meta?.pressPos !== undefined ? meta.pressPos : mapped(pluginState.pressPos);
        const prefocusClickPos =
          meta?.prefocusClickPos !== undefined
            ? meta.prefocusClickPos
            : mapped(pluginState.prefocusClickPos);
        const next = { editorHasFocus, pressPos, prefocusClickPos };

        if (!editorHasFocus || tokenFocusKey.getState(newState)?.focusedPos !== null) {
          return { decorations: DecorationSet.empty, ...next };
        }

        const sel = tr.selection;
        if (sel.empty) {
          return { decorations: DecorationSet.empty, ...next };
        }

        return { decorations: buildSelectionDecorationsForRanges(tr.doc, sel.ranges), ...next };
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
              const targetPos = nearestValidCaret(view.state.doc, clampedPos, 1);

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

          if (handleShiftClickSelection(view, event, posInfo)) {
            return true;
          }

          const pos = posInfo.pos;
          const $pos = view.state.doc.resolve(pos);
          if (!isTokenNode($pos.nodeBefore) && !isTokenNode($pos.nodeAfter)) {
            // Within text the browser places the caret and selects by itself.
            return false;
          }

          // The browser does not reliably place a caret next to a non-editable token, so
          // the press is resolved here. A press on a token itself is left to the token,
          // which enters editing on click.
          event.preventDefault();
          const pressedNode = posInfo.inside >= 0 ? view.state.doc.nodeAt(posInfo.inside) : null;
          const onToken = isTokenNode(pressedNode);
          setPress(view, pos);

          createDragTracker(
            {
              startX: event.clientX,
              startY: event.clientY,
              posAtCoords: (coords) => view.posAtCoords(coords),
            },
            {
              onDragStart: () => {},
              onDragMove: (movePos) => {
                const anchor = selectionGuardKey.getState(view.state)?.pressPos;
                if (anchor == null) return;
                const tr = view.state.tr;
                tr.setSelection(TextSelection.create(tr.doc, anchor, movePos));
                view.dispatch(tr);
              },
              onDragEnd: (wasDrag) => {
                if (!wasDrag && !onToken) placeCaretAtPress(view);
              },
              onCleanup: () => {
                setPress(view, null);
              },
            }
          );

          if (!view.hasFocus()) {
            view.focus();
          }

          return true;
        },
      },

      handleKeyDown(view, event) {
        if (event.isComposing) return false;

        const focusState = tokenFocusKey.getState(view.state);
        if (focusState?.focusedPos !== null) {
          return false;
        }

        const ctx = buildSelectionGuardContext(view, event);
        return runKeyHandlers(selectionGuardKeySpecs, event.key, ctx);
      },
    },
  });
}
