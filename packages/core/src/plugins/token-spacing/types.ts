import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

/**
 * Context passed to each repair phase.
 * Contains all information needed for document repair operations.
 */
export interface RepairContext {
  readonly doc: ProseMirrorNode;
  readonly schema: Schema;
  readonly oldFocusedPos: number | null;
  readonly newFocusedPos: number | null;
  readonly docChanged: boolean;
  readonly focusChanged: boolean;
  readonly isHistoryOperation: boolean;
}

/**
 * Interface for a document repair phase.
 * Each phase is responsible for a specific type of document repair.
 */
export interface DocumentRepairPhase {
  /** Name of the phase for debugging/logging */
  readonly name: string;

  /**
   * Determine if this phase should run given the current context.
   * @param context - The repair context
   * @returns true if the phase should execute
   */
  shouldRun(context: RepairContext): boolean;

  /**
   * Execute the repair operation.
   * @param tr - The transaction to modify
   * @param context - The repair context
   * @returns true if the document was modified
   */
  execute(tr: Transaction, context: RepairContext): boolean;
}
