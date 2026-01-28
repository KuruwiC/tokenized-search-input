/**
 * Spacer Insertion Operations
 *
 * Functions for inserting spacers into documents.
 */
import type { Schema } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

/**
 * Insert a spacer at the given position.
 *
 * @param tr - The transaction to apply the insertion to
 * @param schema - The document schema containing the spacer node type
 * @param pos - The position to insert the spacer at
 * @returns true if the spacer was inserted, false if the schema doesn't have a spacer type
 */
export function insertSpacer(tr: Transaction, schema: Schema, pos: number): boolean {
  const spacerType = schema.nodes.spacer;
  if (!spacerType) return false;
  tr.insert(pos, spacerType.create());
  return true;
}
