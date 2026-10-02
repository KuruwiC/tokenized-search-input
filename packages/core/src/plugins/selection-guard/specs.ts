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
  handleBackspaceFromToken,
  handleDeleteFromToken,
  handleShiftArrowSelection,
} from './handlers';
import {
  hasShiftKey,
  isEmptySelection,
  isTextSelection,
  nodeAfterIsToken,
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
  // --- Shift+Arrow: Range selection over whole tokens ---
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

  // --- Backspace: Enter the token before the caret ---
  {
    key: 'Backspace',
    when: and(isEmptySelection, nodeBeforeIsToken, tokenNotFocused),
    action: handleBackspaceFromToken,
  },

  // --- Delete: Enter the token after the caret ---
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
