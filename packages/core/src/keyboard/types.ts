/**
 * Keyboard handler infrastructure types.
 *
 * This module provides a declarative way to define keyboard handlers
 * using the Registry + Composable pattern (Option B + C).
 */

/**
 * Predicate function that determines if a condition is met.
 * Returns true if the condition is satisfied.
 */
export type Predicate<TContext> = (ctx: TContext) => boolean;

/**
 * Key handler function that processes a keyboard event.
 * Returns true if the event was handled and should stop propagation.
 */
export type KeyHandlerFn<TContext> = (ctx: TContext) => boolean;

/**
 * Key specification that declaratively defines a keyboard handler.
 * Combines a key, a condition (when), and an action.
 */
export interface KeySpec<TContext> {
  /** The key to match (e.g., 'Tab', 'Enter', 'ArrowLeft') */
  key: string;
  /** Predicate that must return true for this handler to run */
  when: Predicate<TContext>;
  /** Handler function to execute when key and condition match */
  action: KeyHandlerFn<TContext>;
}

/**
 * Execute keyboard handlers defined in specs.
 * Iterates through specs matching the key and executes the first
 * handler whose condition is met and returns true.
 *
 * @param specs - Array of key specifications
 * @param key - The key pressed (event.key)
 * @param ctx - Context object passed to predicates and handlers
 * @returns true if a handler processed the event, false otherwise
 */
export function runKeyHandlers<TContext>(
  specs: readonly KeySpec<TContext>[],
  key: string,
  ctx: TContext
): boolean {
  for (const spec of specs) {
    if (spec.key === key && spec.when(ctx) && spec.action(ctx)) {
      return true;
    }
  }
  return false;
}
