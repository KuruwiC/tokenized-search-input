/**
 * Common predicate functions for keyboard handlers.
 *
 * These composable predicates can be combined using and(), or(), not()
 * to build complex conditions declaratively.
 */

import type { Predicate } from './types';

/**
 * Always returns true. Use as a catch-all condition.
 */
export const always =
  <T>(): Predicate<T> =>
  () =>
    true;

/**
 * Always returns false. Use to disable a handler.
 */
export const never =
  <T>(): Predicate<T> =>
  () =>
    false;

/**
 * Logical AND - all predicates must return true.
 *
 * @example
 * and(atStart, noSelection) // true only if at start AND no selection
 */
export const and =
  <T>(...preds: Predicate<T>[]): Predicate<T> =>
  (ctx) =>
    preds.every((p) => p(ctx));

/**
 * Logical OR - at least one predicate must return true.
 *
 * @example
 * or(atStart, atEnd) // true if at start OR at end
 */
export const or =
  <T>(...preds: Predicate<T>[]): Predicate<T> =>
  (ctx) =>
    preds.some((p) => p(ctx));

/**
 * Logical NOT - inverts the predicate result.
 *
 * @example
 * not(hasSelection) // true if no selection
 */
export const not =
  <T>(pred: Predicate<T>): Predicate<T> =>
  (ctx) =>
    !pred(ctx);
