/**
 * Keyboard handler infrastructure.
 *
 * Provides a declarative way to define keyboard handlers using
 * the Registry + Composable pattern.
 *
 * @example
 * ```typescript
 * import { KeySpec, runKeyHandlers, and, always } from './keyboard';
 *
 * const specs: KeySpec<MyContext>[] = [
 *   { key: 'Tab', when: always(), then: handleTab },
 *   { key: 'Backspace', when: and(atStart, noSelection), then: handleBackspace },
 * ];
 *
 * // In event handler:
 * runKeyHandlers(specs, event.key, context);
 * ```
 */

export { always, and, never, not, or } from './predicates';
export type { KeyHandlerFn, KeySpec, Predicate } from './types';
export { runKeyHandlers } from './types';
