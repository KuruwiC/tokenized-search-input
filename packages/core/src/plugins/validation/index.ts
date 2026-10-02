import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { getEditorContext } from '../../extensions/editor-context';
import { buildPlan } from './action-planner';
import { createFieldValidateRule } from './field-validate-rule';
import { applyDeletions, hasUndoableDeletions, writeValidation } from './plan-executor';
import { buildSnapshot, shouldRun } from './snapshot-builder';

export const validationKey = new PluginKey('validation');

// Re-export helpers for testing
export { buildDeletionContext, isNewToken, shouldDeleteNow } from './deletion-planner';
export { FIELD_VALIDATE_RULE_ID } from './field-validate-rule';
// Re-export for external use
export { collectTokens } from './snapshot-builder';
export type { DeletionContext, ValidationPlan, ValidationSnapshot } from './types';

/**
 * The only writer of token validation. On every document change, focus change or
 * requested check it runs the configured rules and the implicit `field-validate`
 * rule, applies the deletions the configured rules call for, and records each
 * token's validation in token meta. Validation never changes node attributes.
 */
export const ValidationExtension = Extension.create({
  name: 'validation',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: validationKey,

        appendTransaction(transactions, oldState, newState) {
          const { run, forceCheck, isHistoryOperation } = shouldRun(transactions, validationKey);
          if (!run) return null;

          const editorContext = getEditorContext(editor);
          const configuredRules = editorContext.validation?.rules ?? [];
          const rules = [...configuredRules, createFieldValidateRule(editorContext)];

          const snap = buildSnapshot(
            oldState,
            newState,
            editorContext.fields,
            rules,
            forceCheck,
            isHistoryOperation
          );

          const tr = newState.tr;
          let undoable = false;
          let violations = snap?.violations ?? [];
          // Deleting tokens is the configured rules' policy; without them validation only marks.
          if (snap && configuredRules.length > 0) {
            const plan = buildPlan(snap, newState.doc);
            violations = applyDeletions(tr, newState, plan, snap);
            undoable = hasUndoableDeletions(plan, snap);
          }

          const validationChanged = writeValidation(tr, newState, violations);
          if (!tr.docChanged && !validationChanged) return null;

          tr.setMeta(validationKey, true);
          if (!undoable) tr.setMeta('addToHistory', false);
          return tr;
        },
      }),
    ];
  },
});
