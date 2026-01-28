import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { buildPlan } from './action-planner';
import { applyPlan, clearInvalidMarksIfNeeded } from './plan-executor';
import { buildSnapshot, shouldRun } from './snapshot-builder';

export const validationKey = new PluginKey('validation');

// Re-export helpers for testing
export { buildDeletionContext, isNewToken, shouldDeleteNow } from './deletion-planner';
// Re-export for external use
export { collectTokens, FORCE_VALIDATION_CHECK } from './snapshot-builder';
export type { DeletionContext, TokenAction, ValidationPlan, ValidationSnapshot } from './types';

export const ValidationExtension = Extension.create({
  name: 'validation',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: validationKey,

        appendTransaction(transactions, oldState, newState) {
          // Step 1: Check if validation should run
          const { run, forceCheck, isHistoryOperation } = shouldRun(transactions, validationKey);
          if (!run) return null;

          // Get editor context from storage (type-safe via module augmentation)
          const editorContext = editor.storage.editorContext;

          if (!editorContext) return null;

          // Step 2: Build unified state snapshot
          const snap = buildSnapshot(
            oldState,
            newState,
            editorContext,
            forceCheck,
            isHistoryOperation
          );

          // If validation is disabled, handle special cases
          if (!snap) {
            return clearInvalidMarksIfNeeded(newState, validationKey);
          }

          // Step 3: Build plan of actions (pure logic)
          const plan = buildPlan(snap, newState.doc);

          // Skip if no actions needed
          if (plan.actions.length === 0) return null;

          // Step 4: Apply the plan
          return applyPlan(newState, plan, snap, validationKey);
        },
      }),
    ];
  },
});
