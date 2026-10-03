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

/** Evaluated in order; the more specific specs come before the general ones. */
const selectionGuardKeySpecs: readonly KeySpec[] = [
  // Shift+Arrow must come before the plain Arrow specs.
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

  {
    key: 'Backspace',
    when: and(isEmptySelection, nodeBeforeIsToken, tokenNotFocused),
    action: handleBackspaceFromToken,
  },

  {
    key: 'Delete',
    when: and(isEmptySelection, nodeAfterIsToken, tokenNotFocused),
    action: handleDeleteFromToken,
  },

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
