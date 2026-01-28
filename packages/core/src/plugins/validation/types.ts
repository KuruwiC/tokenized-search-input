import type { FieldDefinition, ValidationConfig, ValidationToken, Violation } from '../../types';

export interface ValidationSnapshot {
  tokens: ValidationToken[];
  focus: {
    previousPos: number | null;
    currentPos: number | null;
  };
  /** IDs of tokens that are newly created in this transaction */
  newTokenIds: Set<string>;
  /** IDs of tokens whose key, operator, or value was modified in this transaction */
  modifiedTokenIds: Set<string>;
  /** IDs of tokens being edited: newTokenIds ∪ modifiedTokenIds ∪ focus-based tokens */
  editingTokenIds: Set<string>;
  /** Violations returned by validators */
  violations: Violation[];
  forceCheck: boolean;
  isHistoryOperation: boolean;
  fields: FieldDefinition[];
  validation: ValidationConfig;
}

export type TokenAction =
  | { type: 'mark'; pos: number; reason?: string }
  | { type: 'clear'; pos: number }
  | {
      type: 'delete';
      pos: number;
      nodeSize: number;
      /** True if this is an orphaned empty token deletion (should not be in history) */
      isOrphanedEmpty?: boolean;
    };

export interface ValidationPlan {
  actions: TokenAction[];
}

export interface DeletionContext {
  creationInProgress: boolean;
  newTokenByKey: Map<string, number>;
  firstOccurrenceByKey: Map<string, number>;
}

export interface ShouldRunResult {
  run: boolean;
  forceCheck: boolean;
  isHistoryOperation: boolean;
}
