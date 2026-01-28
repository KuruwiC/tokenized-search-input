import type { EditorState, Transaction } from '@tiptap/pm/state';
import {
  applySpacerDeletion,
  checkBoundaryNeedsSpace,
  expandWithSpacers,
  mergeOverlappingRanges,
} from '../../spacer';
import { isToken } from '../../utils/node-predicates';
import { updateTokenAttrs } from '../../utils/token-attrs';
import { buildPlan } from './action-planner';
import { collectTokens } from './snapshot-builder';
import type { TokenAction, ValidationPlan, ValidationSnapshot } from './types';
import { runValidation } from './validation-runner';

export function applyPlan(
  state: EditorState,
  plan: ValidationPlan,
  snap: ValidationSnapshot,
  validationKey: import('@tiptap/pm/state').PluginKey
): Transaction | null {
  const tr = state.tr;

  // 1. Apply deletions (reverse order for position stability)
  const deletions = plan.actions.filter(
    (a): a is Extract<TokenAction, { type: 'delete' }> => a.type === 'delete'
  );

  if (deletions.length > 0) {
    // Expand deletions with spacers
    const ranges = deletions.map((del) => expandWithSpacers(state.doc, del.pos, del.nodeSize));

    // Merge overlapping ranges
    const mergedRanges = mergeOverlappingRanges(ranges);

    // Recompute needsSpaceSeparator based on actual merged boundaries
    for (const range of mergedRanges) {
      range.needsSpaceSeparator = checkBoundaryNeedsSpace(state.doc, range.from, range.to);
    }

    // Delete in reverse order and insert space where needed
    mergedRanges.sort((a, b) => b.from - a.from);
    for (const range of mergedRanges) {
      applySpacerDeletion(tr, state.schema, range);
    }
  }

  // 2. Revalidate remaining tokens if deletions occurred
  let tokensAfterDeletion = snap.tokens;
  let violationsAfterDeletion = snap.violations;

  if (deletions.length > 0) {
    tokensAfterDeletion = collectTokens(tr.doc);
    if (tokensAfterDeletion.length > 0) {
      // After deletions, positions have shifted and blur has been handled
      // Use empty set since deletion already completed (no tokens are "editing")
      violationsAfterDeletion = runValidation(
        tokensAfterDeletion,
        snap.fields,
        snap.validation,
        new Set()
      );
    }
  }

  // 3. Apply marks/clears (rebuild plan for remaining tokens after deletion)
  const remainingPlan =
    deletions.length > 0
      ? buildPlan(
          {
            ...snap,
            tokens: tokensAfterDeletion,
            violations: violationsAfterDeletion,
            focus: { previousPos: null, currentPos: null },
            forceCheck: false,
            isHistoryOperation: false,
            // Clear newTokenIds to prevent re-triggering deletion logic
            newTokenIds: new Set(),
            modifiedTokenIds: new Set(),
          },
          tr.doc
        )
      : plan;

  for (const action of remainingPlan.actions) {
    if (action.type === 'mark') {
      const node = tr.doc.nodeAt(action.pos);
      if (node && isToken(node)) {
        updateTokenAttrs(tr, action.pos, {
          invalid: true,
          invalidReason: action.reason,
        });
      }
    } else if (action.type === 'clear') {
      const node = tr.doc.nodeAt(action.pos);
      if (node && isToken(node)) {
        updateTokenAttrs(tr, action.pos, {
          invalid: false,
          invalidReason: undefined,
        });
      }
    }
  }

  if (!tr.docChanged) return null;

  tr.setMeta(validationKey, true);

  // Determine if this transaction should be added to history:
  // - Deletions from validation rules (e.g., Unique.replace) should be in history
  //   so that undo restores the deleted tokens
  // - Orphaned empty token cleanup should NOT be in history
  //   (these are incomplete tokens left over from undo or cancelled creation)
  // - Empty token cleanup on history operations should NOT be in history
  //   (it's a side effect of undo/redo, not a user action)
  // - Mark/clear only changes should NOT be in history
  const validationDeletions = deletions.filter((d) => !d.isOrphanedEmpty);
  const hasValidationDeletions = validationDeletions.length > 0 && !snap.isHistoryOperation;

  if (!hasValidationDeletions) {
    tr.setMeta('addToHistory', false);
  }

  return tr;
}

export function clearInvalidMarksIfNeeded(
  state: EditorState,
  validationKey: import('@tiptap/pm/state').PluginKey
): Transaction | null {
  const tokens = collectTokens(state.doc);
  const invalidTokens = tokens.filter((t) => {
    const node = state.doc.nodeAt(t.pos);
    return node?.attrs.invalid;
  });

  if (invalidTokens.length === 0) return null;

  const tr = state.tr;
  for (const token of invalidTokens) {
    const node = state.doc.nodeAt(token.pos);
    if (node) {
      updateTokenAttrs(tr, token.pos, {
        invalid: false,
        invalidReason: undefined,
      });
    }
  }

  if (!tr.docChanged) return null;

  tr.setMeta(validationKey, true);
  tr.setMeta('addToHistory', false);
  return tr;
}

export function deleteEmptyTokensOnHistory(
  state: EditorState,
  validationKey: import('@tiptap/pm/state').PluginKey
): Transaction | null {
  const tokens = collectTokens(state.doc);
  const emptyTokens = tokens.filter((t) => !t.value);

  if (emptyTokens.length === 0) return null;

  const tr = state.tr;

  // Delete in reverse order to maintain valid positions
  const sortedTokens = [...emptyTokens].sort((a, b) => b.pos - a.pos);

  for (const token of sortedTokens) {
    const node = state.doc.nodeAt(token.pos);
    if (!node) continue;

    // Expand deletion range to include surrounding spacers and apply deletion
    const range = expandWithSpacers(state.doc, token.pos, node.nodeSize);
    applySpacerDeletion(tr, state.schema, range);
  }

  if (!tr.docChanged) return null;

  tr.setMeta(validationKey, true);
  tr.setMeta('addToHistory', false);
  return tr;
}
