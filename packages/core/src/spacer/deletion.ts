/**
 * Spacer Deletion Operations
 *
 * Functions for applying spacer deletions to transactions.
 */
import type { Schema } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import type { SpacerExpandedRange } from './types';

/**
 * Apply spacer deletion to transaction.
 * Centralizes mutation logic: replaces with space if needed, otherwise deletes.
 *
 * This unifies the mutation logic from:
 * - validation/plan-executor.ts (validation deletions)
 * - token-spacing/phases/empty-token-cleanup.ts (focus change cleanup)
 */
export function applySpacerDeletion(
  tr: Transaction,
  schema: Schema,
  range: SpacerExpandedRange
): void {
  const { from, to, needsSpaceSeparator } = range;

  if (from === to) {
    return;
  }

  if (needsSpaceSeparator) {
    tr.replaceWith(from, to, schema.text(' '));
  } else {
    tr.delete(from, to);
  }
}
