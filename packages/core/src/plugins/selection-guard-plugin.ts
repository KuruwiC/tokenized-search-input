/**
 * Selection Guard Plugin
 *
 * Handles the pointer and keyboard input around tokens that the browser would get
 * wrong on its own: a press next to a token puts the caret where it landed or starts a
 * drag selection from there, Shift+click and Shift+Arrow select whole tokens, the
 * arrow keys and Backspace/Delete enter the token beside the caret, and text entered over
 * a selection that holds a token replaces the selection.
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { type EditorState, Plugin, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { TOKEN_NODE_CLASS } from '../tokens/composition/node-view-update';
import { nearestValidCaret } from '../utils/caret';
import { isToken } from '../utils/node-predicates';
import { createDragTracker } from './selection-guard/drag-tracker';
import {
  getSelectionGuardMeta,
  type SelectionGuardState,
  selectionGuardKey,
  setSelectionGuardMeta,
} from './selection-guard/plugin-key';
import { handleShiftClickSelection } from './selection-guard/shift-click-handler';
import { runKeySpecs } from './selection-guard/specs';
import { buildSelectionGuardContext } from './selection-guard/types';
import { type FocusTransitionContext, getFocusedToken, leaveFocusedTokenIn } from './token-focus';
import { gapPosAtCoords } from './token-gap-decorations';

export type { SelectionGuardState } from './selection-guard/plugin-key';

const CSS_RANGE_SELECTED = '_tsi-pm-range-selected';
const PRIMARY_MOUSE_BUTTON = 0;

/** Whether the click landed in the editor's padding rather than its content box. */
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

function selectionHoldsToken(state: EditorState): boolean {
  const { from, to, empty } = state.selection;
  if (empty) return false;
  let holdsToken = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (isToken(node)) holdsToken = true;
    return !holdsToken;
  });
  return holdsToken;
}

/**
 * Replaces a selection that holds a token with `text` in one transaction, before the
 * browser edits it. Browsers do not reliably replace a selection over a non-editable
 * token: WebKit puts the inserted text at the end of the paragraph when the selection
 * runs backwards, and Chromium drops a composition that starts over it. Text the browser
 * hands over at once (a key, an input method commit, an emoji picker, dictation,
 * autocorrect) replaces the selection; a composition starts from the caret the empty
 * replacement leaves, and the browser composes there.
 *
 * @returns whether the selection held a token and was replaced
 */
function replaceTokenSelection(view: EditorView, text: string): boolean {
  if (getFocusedToken(view.state) !== null || !selectionHoldsToken(view.state)) return false;
  const { from, to } = view.state.selection;
  const replace = () => view.state.tr.insertText(text, from, to).scrollIntoView();
  if (text === '' || !view.someProp('handleTextInput', (f) => f(view, from, to, text, replace))) {
    view.dispatch(replace());
  }
  return true;
}

/** The text a beforeinput inserts as a whole, or null when it is not such an insertion. */
function insertedText(event: InputEvent): string | null {
  if (!event.cancelable || event.isComposing) return null;
  if (event.inputType !== 'insertText' && event.inputType !== 'insertReplacementText') {
    return null;
  }
  return event.data ?? event.dataTransfer?.getData('text/plain') ?? null;
}

function setPress(view: EditorView, pressPos: number | null): void {
  const tr = view.state.tr;
  setSelectionGuardMeta(tr, { pressPos });
  view.dispatch(tr);
}

type GetFocusContext = (state: EditorState) => FocusTransitionContext;

/** The position under the pointer, where a press on the space between tokens is the gap. */
function posAtPointer(
  view: EditorView,
  coords: { left: number; top: number }
): { pos: number; inside: number } | null {
  const gapPos = gapPosAtCoords(view, coords);
  if (gapPos === null) return view.posAtCoords(coords);
  const $gap = view.state.doc.resolve(gapPos);
  return { pos: gapPos, inside: $gap.depth > 0 ? $gap.before() : -1 };
}

function placeCaretAt(view: EditorView, pos: number, getFocusContext: GetFocusContext): void {
  const tr = view.state.tr;
  leaveFocusedTokenIn(tr, getFocusContext(view.state));
  tr.setSelection(TextSelection.create(tr.doc, nearestValidCaret(tr.doc, pos, 1)));
  view.dispatch(tr);
  view.focus();
}

function placeCaretAtPress(view: EditorView, getFocusContext: GetFocusContext): void {
  const pressPos = selectionGuardKey.getState(view.state)?.pressPos;
  if (pressPos == null) return;
  placeCaretAt(view, pressPos, getFocusContext);
}

function isInToken(element: Element | null): boolean {
  return element?.closest(`.${TOKEN_NODE_CLASS}`) != null;
}

/**
 * A touch acts on what lies under the finger. Chromium moves a tap to the nearest element
 * that responds to presses, so a tap between tokens, or next to one, arrives as a press on
 * a token's delete button or label. The pointerdown that starts the tap still carries the
 * point the finger touched; when that point is outside every token and the press that
 * follows targets a token, the press and its click are kept from the token and the caret
 * goes where the finger landed.
 */
function guardTouchRetargeting(
  view: EditorView,
  getFocusContext: GetFocusContext
): { destroy: () => void } {
  let touch: { left: number; top: number } | null = null;
  let swallowClick = false;

  const onPointerDown = (event: PointerEvent) => {
    touch = event.pointerType === 'touch' ? { left: event.clientX, top: event.clientY } : null;
    swallowClick = false;
  };
  const onMouseDown = (event: MouseEvent) => {
    const coords = touch;
    touch = null;
    if (coords === null || event.button !== PRIMARY_MOUSE_BUTTON) return;
    if (
      !isInToken(event.target as Element) ||
      isInToken(view.root.elementFromPoint(coords.left, coords.top))
    ) {
      return;
    }
    const posInfo = posAtPointer(view, coords);
    if (!posInfo) return;
    event.preventDefault();
    event.stopPropagation();
    swallowClick = true;
    placeCaretAt(view, posInfo.pos, getFocusContext);
  };
  const onClick = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const dom = view.dom;
  dom.addEventListener('pointerdown', onPointerDown, true);
  dom.addEventListener('mousedown', onMouseDown, true);
  dom.addEventListener('click', onClick, true);
  return {
    destroy() {
      dom.removeEventListener('pointerdown', onPointerDown, true);
      dom.removeEventListener('mousedown', onMouseDown, true);
      dom.removeEventListener('click', onClick, true);
    },
  };
}

export function createSelectionGuardPlugin(
  getFocusContext: GetFocusContext
): Plugin<SelectionGuardState> {
  return new Plugin<SelectionGuardState>({
    key: selectionGuardKey,

    view: (view) => guardTouchRetargeting(view, getFocusContext),

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
        const meta = getSelectionGuardMeta(tr);
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

        if (!editorHasFocus || getFocusedToken(newState) !== null) {
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
        beforeinput(view, event) {
          const text = insertedText(event);
          if (text === null || text === '' || /[\r\n]/.test(text)) return false;
          if (!replaceTokenSelection(view, text)) return false;
          event.preventDefault();
          return true;
        },
        compositionstart(view) {
          // The composition itself stays with ProseMirror and the browser.
          replaceTokenSelection(view, '');
          return false;
        },
        focus(view) {
          const pluginState = selectionGuardKey.getState(view.state);
          const prefocusClickPos = pluginState?.prefocusClickPos ?? null;

          const tr = view.state.tr;
          setSelectionGuardMeta(tr, { editorHasFocus: true, prefocusClickPos: null });
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
              view.dispatch(newTr);
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

          setSelectionGuardMeta(tr, { editorHasFocus: false });
          view.dispatch(tr);
          return false;
        },
        mousedown(view, event) {
          if (event.button !== PRIMARY_MOUSE_BUTTON) return false;

          const coords = { left: event.clientX, top: event.clientY };
          const posInfo = posAtPointer(view, coords);
          if (!posInfo) return false;

          if (!event.shiftKey) {
            if (isPaddingClick(view, event)) {
              event.preventDefault();
              const tr = view.state.tr;
              leaveFocusedTokenIn(tr, getFocusContext(view.state));
              tr.setSelection(TextSelection.create(tr.doc, tr.doc.resolve(1).end()));
              view.dispatch(tr);
              view.focus();
              return true;
            }
          }

          if (!view.hasFocus() && !event.shiftKey) {
            const tr = view.state.tr;
            setSelectionGuardMeta(tr, { prefocusClickPos: posInfo.pos });
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
              posAtCoords: (coords) => posAtPointer(view, coords),
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
                if (!wasDrag && !onToken) placeCaretAtPress(view, getFocusContext);
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

        if (getFocusedToken(view.state) !== null) return false;

        const ctx = buildSelectionGuardContext(view, event, getFocusContext(view.state));
        return runKeySpecs(event.key, ctx);
      },
    },
  });
}
