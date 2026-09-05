/**
 * Predicates and an ordered dispatcher for keyboard handlers.
 *
 * @example
 * ```typescript
 * import { KeySpec, runKeyHandlers, and, always } from './keyboard';
 *
 * const specs: KeySpec<MyContext>[] = [
 *   { key: 'Tab', when: always(), action: handleTab },
 *   { key: 'Backspace', when: and(atStart, noSelection), action: handleBackspace },
 * ];
 *
 * runKeyHandlers(specs, event.key, context);
 * ```
 */

export { always, and, never, not, or } from './predicates';
export type { KeyHandlerFn, KeySpec, Predicate } from './types';
export { runKeyHandlers } from './types';
