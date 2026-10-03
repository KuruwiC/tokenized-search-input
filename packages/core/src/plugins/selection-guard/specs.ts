/**
 * Declarative key specifications for selection guard keyboard handlers.
 *
 * Each spec defines: key, when (condition), action.
 * Specs are evaluated in order - first matching spec wins.
 */

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
import type { KeyHandler, Predicate, SelectionGuardContext } from './types';

interface KeySpec {
  key: string;
  when: Predicate;
  action: KeyHandler;
}

const and =
  (...predicates: Predicate[]): Predicate =>
  (ctx) =>
    predicates.every((predicate) => predicate(ctx));

/**
 * Selection guard keyboard specifications.
 *
 * Order matters - more specific specs should come before general ones.
 */
const selectionGuardKeySpecs: readonly KeySpec[] = [
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

/** Runs the first spec for `key` whose condition holds and whose action handles the press. */
export function runKeySpecs(key: string, ctx: SelectionGuardContext): boolean {
  return selectionGuardKeySpecs.some(
    (spec) => spec.key === key && spec.when(ctx) && spec.action(ctx)
  );
}
