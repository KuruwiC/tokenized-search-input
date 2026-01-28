/**
 * Utility functions for selection guard plugin.
 */
import type { Transaction } from '@tiptap/pm/state';
import { selectionGuardKey } from './plugin-key';

/**
 * Mark transaction as handled by selection guard.
 * Returns the transaction for chaining.
 */
export function markAsGuarded(tr: Transaction): Transaction {
  return tr.setMeta(selectionGuardKey, { guarded: true });
}
