/**
 * Declarative key specifications for selection guard keyboard handlers.
 *
 * Each spec defines: key, when (condition), action.
 * Specs are evaluated in order - first matching spec wins.
 */

import type { KeySpec } from '../../keyboard';
import { and } from '../../keyboard';
import {
  handleArrowMove,
  handleBackspaceFromSpacer,
  handleBackspaceFromToken,
  handleDeleteFromSpacer,
  handleDeleteFromToken,
  handleShiftArrowSelection,
} from './handlers';
import {
  hasShiftKey,
  hasTokenAfterSpacer,
  hasTokenBeforeSpacer,
  isEmptySelection,
  isTextSelection,
  nodeAfterIsSpacer,
  nodeAfterIsToken,
  nodeBeforeIsSpacer,
  nodeBeforeIsToken,
  tokenNotFocused,
} from './predicates';
import type { SelectionGuardContext } from './types';

/**
 * Selection guard keyboard specifications.
 *
 * Order matters - more specific specs should come before general ones.
 */
export const selectionGuardKeySpecs: readonly KeySpec<SelectionGuardContext>[] = [
  // --- Shift+Arrow: Range selection (Spacer skip) ---
  // Must come before regular arrow handling
  {
    key: 'ArrowLeft',
    when: and(hasShiftKey, isTextSelection, tokenNotFocused),
    action: handleShiftArrowSelection,
  },
  {
    key: 'ArrowRight',
    when: and(hasShiftKey, isTextSelection, tokenNotFocused),
    action: handleShiftArrowSelection,
  },

  // --- Backspace: Enter token from boundary ---
  // Case 1: Cursor after spacer with token before it
  {
    key: 'Backspace',
    when: and(isEmptySelection, nodeBeforeIsSpacer, hasTokenBeforeSpacer, tokenNotFocused),
    action: handleBackspaceFromSpacer,
  },
  // Case 2: Cursor directly after token (exitTokenLeft skipped spacer)
  {
    key: 'Backspace',
    when: and(isEmptySelection, nodeBeforeIsToken, tokenNotFocused),
    action: handleBackspaceFromToken,
  },

  // --- Delete: Enter token from boundary ---
  // Case 1: Cursor before spacer with token after it
  {
    key: 'Delete',
    when: and(isEmptySelection, nodeAfterIsSpacer, hasTokenAfterSpacer, tokenNotFocused),
    action: handleDeleteFromSpacer,
  },
  // Case 2: Cursor directly before token (exitTokenRight skipped spacer)
  {
    key: 'Delete',
    when: and(isEmptySelection, nodeAfterIsToken, tokenNotFocused),
    action: handleDeleteFromToken,
  },

  // --- Arrow: Regular cursor movement ---
  {
    key: 'ArrowLeft',
    when: and(isEmptySelection, tokenNotFocused),
    action: handleArrowMove,
  },
  {
    key: 'ArrowRight',
    when: and(isEmptySelection, tokenNotFocused),
    action: handleArrowMove,
  },
];
