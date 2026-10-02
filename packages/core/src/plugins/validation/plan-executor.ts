import type { EditorState, Transaction } from '@tiptap/pm/state';
import {
  applySpacerDeletion,
  checkBoundaryNeedsSpace,
  expandWithSpacers,
  mergeOverlappingRanges,
} from '../../spacer';
import type { Violation } from '../../types';
import { setTokenMeta, type TokenValidation } from '../shared/meta';
import { tokenMetaKey } from '../token-meta-plugin';
import { collectTokens } from './snapshot-builder';
import type { ValidationPlan, ValidationSnapshot } from './types';
import { runValidation } from './validation-runner';

/**
 * Applies the planned deletions to `tr` and returns the violations of the tokens
 * that remain.
 */
export function applyDeletions(
  tr: Transaction,
  state: EditorState,
  plan: ValidationPlan,
  snap: ValidationSnapshot
): Violation[] {
  const { deletions } = plan;
  if (deletions.length === 0) return snap.violations;

  const ranges = deletions.map((del) => expandWithSpacers(state.doc, del.pos, del.nodeSize));
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

  // Positions have shifted and the deletion is complete, so no token is "editing".
  const remaining = collectTokens(tr.doc);
  return runValidation(remaining, snap.fields, snap.rules, new Set());
}

/** Whether the deletions in the plan should be undoable. */
export function hasUndoableDeletions(plan: ValidationPlan, snap: ValidationSnapshot): boolean {
  // Deletions from validation rules (e.g., Unique.replace) are undoable. Cleanup of
  // orphaned empty tokens and anything done during undo/redo is not a user action.
  return !snap.isHistoryOperation && plan.deletions.some((d) => !d.isOrphanedEmpty);
}

function toValidation(violation: Violation): TokenValidation {
  const validation: TokenValidation = { ruleId: violation.ruleId, reason: violation.reason };
  if (violation.message !== undefined) validation.message = violation.message;
  return validation;
}

function sameValidation(a: TokenValidation | undefined, b: TokenValidation | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.ruleId === b.ruleId && a.reason === b.reason && a.message === b.message;
}

/**
 * Writes the validation of every token in `tr.doc` to token meta, and clears it
 * for tokens that left the document. The first violation targeting a token wins.
 *
 * @returns whether any token's validation changed
 */
export function writeValidation(
  tr: Transaction,
  state: EditorState,
  violations: readonly Violation[]
): boolean {
  const desired = new Map<string, TokenValidation>();
  for (const violation of violations) {
    for (const target of violation.targets) {
      if (!desired.has(target.tokenId)) desired.set(target.tokenId, toValidation(violation));
    }
  }

  const entries = tokenMetaKey.getState(state)?.entries ?? new Map();
  let changed = false;
  const present = new Set<string>();
  for (const token of collectTokens(tr.doc)) {
    present.add(token.id);
    const next = desired.get(token.id);
    if (!sameValidation(entries.get(token.id)?.validation, next)) {
      setTokenMeta(tr, token.id, { validation: next });
      changed = true;
    }
  }
  for (const [id, meta] of entries) {
    if (!present.has(id) && meta.validation) {
      setTokenMeta(tr, id, { validation: undefined });
      changed = true;
    }
  }
  return changed;
}
