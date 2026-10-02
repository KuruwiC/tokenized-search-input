import type { TokenFocusEntry } from '../../../plugins/token-focus-plugin';
import type { FocusRegistry } from '../contexts';

/**
 * Gives DOM focus to the block that `entry` enters the token at, with the caret at the
 * entry's position. A keyboard entry at the end comes from the right, so it is the
 * last such block; every other entry takes the first.
 */
export function focusEntryBlock(registry: FocusRegistry, entry: TokenFocusEntry): void {
  const fromRight = entry.source === 'keyboard' && entry.position === 'end';
  registry.navigateAbsolute(fromRight ? 'last' : 'first', {
    filter: entry.target === 'entry' ? 'all' : 'entryFocusable',
    position: entry.position,
  });
}
