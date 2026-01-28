/**
 * Selection Invariant Plugin
 *
 * Enforces cursor position rules around tokens and spacers.
 * Ensures cursor never lands inside tokens without explicit user intent.
 *
 * INVARIANT: Cursor can be on a spacer, but entering a token requires explicit action.
 *
 * Responsibilities:
 * 1. Detect cursor inside token (invalid position) and correct it
 * 2. Handle range selection collapsing to token boundary
 * 3. Boundary-based enforcement for keyboard navigation
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { isToken } from '../utils/node-predicates';
import { safeResolve } from '../utils/safe-resolve';
import { selectionGuardKey } from './selection-guard/plugin-key';
import { getDragStateEvent } from './shared/editor-events';
import { setTokenFocus, tokenFocusKey } from './token-focus-plugin';
import {
  enforceSelectionInvariant,
  getCursorInsideToken,
} from './token-spacing/selection-invariant';
import { findSpacerAfter, findSpacerBefore } from './token-spacing/spacer-helpers';

export const selectionInvariantKey = new PluginKey('selectionInvariant');

export const SelectionInvariantExtension = Extension.create({
  name: 'selectionInvariant',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: selectionInvariantKey,

        appendTransaction(transactions, oldState, newState) {
          // Skip if this plugin already processed
          if (transactions.some((tr) => tr.getMeta(selectionInvariantKey))) return null;

          // Skip during IME composition
          if (transactions.some((tr) => tr.getMeta('composition'))) return null;

          // Skip when exiting a token (let TokenSpacing handle cleanup first)
          if (transactions.some((tr) => tr.getMeta('exitingToken'))) return null;

          const newFocusState = tokenFocusKey.getState(newState);
          const newFocusedPos = newFocusState?.focusedPos ?? null;

          // Only enforce when no token is focused (normal navigation mode)
          if (newFocusedPos !== null) return null;

          const { selection } = newState;
          if (!(selection instanceof TextSelection) || !selection.empty) return null;

          const tr = newState.tr;
          let selectionModified = false;

          // Pre-compute selection state flags
          const oldSelection = oldState.selection;
          const wasRangeSelection = oldSelection instanceof TextSelection && !oldSelection.empty;
          const hadCursor = oldSelection instanceof TextSelection && oldSelection.empty;

          // Phase A: Check if cursor is inside a token (invalid position)
          const insideToken = getCursorInsideToken(tr.doc, selection.from);
          if (insideToken) {
            if (insideToken.isImmutable) {
              // Immutable token: move cursor to the closer boundary
              const distToStart = selection.from - insideToken.tokenPos;
              const distToEnd = insideToken.tokenEnd - selection.from;
              const newPos = distToStart <= distToEnd ? insideToken.tokenPos : insideToken.tokenEnd;
              tr.setSelection(TextSelection.create(tr.doc, newPos));
              selectionModified = true;
            } else if (wasRangeSelection) {
              // Mutable token: enter edit mode from the appropriate side
              const distToStart = selection.from - insideToken.tokenPos;
              const distToEnd = insideToken.tokenEnd - selection.from;
              const direction = distToStart <= distToEnd ? 'from-left' : 'from-right';
              setTokenFocus(tr, {
                focusedPos: insideToken.tokenPos,
                cursorPosition: { direction, policy: 'all' },
              });
              selectionModified = true;
            }
          }

          // Phase B: Handle range selection collapsing to cursor at token boundary
          if (!selectionModified && wasRangeSelection) {
            const $pos = safeResolve(tr.doc, selection.from);
            if ($pos) {
              const nodeBefore = $pos.nodeBefore;
              const nodeAfter = $pos.nodeAfter;

              if (nodeAfter && isToken(nodeAfter)) {
                // Cursor directly before a token
                const isImmutable = nodeAfter.attrs.immutable === true;
                if (isImmutable) {
                  const spacerPos = findSpacerBefore(tr.doc, selection.from);
                  if (spacerPos !== null) {
                    tr.setSelection(TextSelection.create(tr.doc, spacerPos));
                    selectionModified = true;
                  }
                } else {
                  setTokenFocus(tr, {
                    focusedPos: selection.from,
                    cursorPosition: { direction: 'from-left', policy: 'all' },
                  });
                  selectionModified = true;
                }
              } else if (nodeBefore && isToken(nodeBefore)) {
                // Cursor directly after a token
                const isImmutable = nodeBefore.attrs.immutable === true;
                const tokenPos = selection.from - nodeBefore.nodeSize;
                if (isImmutable) {
                  const spacerPos = findSpacerAfter(tr.doc, selection.from);
                  if (spacerPos !== null) {
                    tr.setSelection(TextSelection.create(tr.doc, spacerPos));
                    selectionModified = true;
                  }
                } else {
                  setTokenFocus(tr, {
                    focusedPos: tokenPos,
                    cursorPosition: { direction: 'from-right', policy: 'all' },
                  });
                  selectionModified = true;
                }
              }
            }
          }

          // Phase C: Boundary-based invariant enforcement for cursor movement
          if (!selectionModified) {
            // Firefox fires intermediate transactions with empty selection during drag,
            // which would incorrectly trigger token focus. Treat drag as "no movement".
            // Check drag state from transaction Meta first, then fall back to plugin state
            const dragEvent = transactions.map((t) => getDragStateEvent(t)).find(Boolean);
            const guardState = selectionGuardKey.getState(newState);
            const isDragging = dragEvent?.isDragging ?? guardState?.isDragging ?? false;
            const moveDirection = hadCursor && !isDragging ? selection.from - oldSelection.from : 0;

            const action = enforceSelectionInvariant(tr.doc, selection.from, moveDirection);
            if (action) {
              if (action.type === 'move') {
                tr.setSelection(TextSelection.create(tr.doc, action.pos));
              } else {
                setTokenFocus(tr, {
                  focusedPos: action.tokenPos,
                  cursorPosition: action.cursor,
                });
              }
              selectionModified = true;
            }
          }

          if (!selectionModified) return null;

          // Selection-only changes should not be undoable
          tr.setMeta('addToHistory', false);
          tr.setMeta(selectionInvariantKey, { enforced: true });

          return tr;
        },
      }),
    ];
  },
});
