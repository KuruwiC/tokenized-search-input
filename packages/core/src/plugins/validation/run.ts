import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import {
  applySpacerDeletion,
  checkBoundaryNeedsSpace,
  expandWithSpacers,
  mergeOverlappingRanges,
  type SpacerExpandedRange,
} from '../../spacer';
import type {
  FieldDefinition,
  ValidationContext,
  ValidationRule,
  ValidationToken,
  Violation,
} from '../../types';
import { findTokenById } from '../../utils/find-token';
import { isFilterToken, isFreeTextToken } from '../../utils/node-predicates';
import { ensureTokenId } from '../../utils/token-id';
import { setTokenMeta, type TokenValidation } from '../shared/meta';

export function collectTokens(doc: ProseMirrorNode): ValidationToken[] {
  const tokens: ValidationToken[] = [];

  doc.descendants((node) => {
    if (isFilterToken(node)) {
      const { id, key, operator, value } = node.attrs;
      const valueStr = String(value ?? '');
      tokens.push({
        id: ensureTokenId(id),
        type: 'filter',
        key: key || '',
        operator: operator || 'is',
        value: valueStr,
        rawValue: valueStr,
      });
    } else if (isFreeTextToken(node)) {
      const { id, value } = node.attrs;
      const valueStr = String(value ?? '');
      tokens.push({
        id: ensureTokenId(id),
        type: 'freeText',
        key: '',
        operator: '',
        value: valueStr,
        rawValue: valueStr,
      });
    }
    return true;
  });

  return tokens;
}

export interface ValidationInput {
  fields: FieldDefinition[];
  /** The rules the application configured. Only they may delete tokens. */
  rules: readonly ValidationRule[];
  /** Rules that run whether or not any are configured. They only mark. */
  implicitRules: readonly ValidationRule[];
  /** The token the user is in, if any. */
  focusedTokenId: string | null;
  /**
   * The document from when the user entered the token they are in, if any. A token
   * typed into over several transactions is edited until they leave it, so edits
   * are measured from here instead of from the previous document.
   */
  editBase: ProseMirrorNode | null;
  /** Validate the whole content as if every token had just been entered. */
  forceCheck: boolean;
  /** The change is an undo or redo, which never deletes tokens. */
  isHistoryOperation: boolean;
  /** The validation token meta holds now, by token id. */
  recorded: ReadonlyMap<string, TokenValidation>;
}

export interface ValidationChange {
  tokenId: string;
  /** `undefined` clears the token's validation. */
  validation: TokenValidation | undefined;
}

/** What to do to the document and to token meta after validating it. */
export interface Plan {
  /** Ids of the tokens to delete. */
  deletions: readonly string[];
  /** Whether the deletions are a user-visible change that undo should revert. */
  undoable: boolean;
  /** Token meta writes for the tokens that remain, and for those that left. */
  changes: readonly ValidationChange[];
}

type Fingerprint = Pick<ValidationToken, 'key' | 'operator' | 'value'>;

function sameContent(a: Fingerprint, b: Fingerprint): boolean {
  return a.key === b.key && a.operator === b.operator && a.value === b.value;
}

/** The ids of the tokens added, and of those changed in key, operator or value, going from `prev` to `next`. */
function diffTokens(
  prev: ValidationToken[],
  next: ValidationToken[]
): { added: Set<string>; changed: Set<string> } {
  const before = new Map(prev.map((t) => [t.id, t]));
  const added = new Set<string>();
  const changed = new Set<string>();
  for (const token of next) {
    const old = before.get(token.id);
    if (!old) added.add(token.id);
    else if (!sameContent(old, token)) changed.add(token.id);
  }
  return { added, changed };
}

/** The tokens being edited, and those that the transactions being validated added. */
function editedTokens(
  prev: ProseMirrorNode,
  next: ValidationToken[],
  input: ValidationInput
): { added: Set<string>; editing: Set<string> } {
  // Restored by undo or redo, so nothing counts as entered.
  if (input.isHistoryOperation) return { added: new Set(), editing: new Set() };

  const group = diffTokens(collectTokens(prev), next);
  const since = input.editBase ? diffTokens(collectTokens(input.editBase), next) : group;
  const editing = new Set([...since.added, ...since.changed]);

  // Nothing differs but everything was requested (initial value, rules changed).
  if (input.forceCheck && editing.size === 0) {
    return { added: group.added, editing: new Set(next.map((t) => t.id)) };
  }
  return { added: group.added, editing };
}

function isRuleDisabled(ruleId: string, field: FieldDefinition | undefined): boolean {
  return field?.validation?.[ruleId] === false;
}

/** The violations of every rule, from the highest priority to the lowest. */
function runRules(rules: readonly ValidationRule[], ctx: ValidationContext): Violation[] {
  const fieldOf = new Map(ctx.tokens.map((t) => [t.id, ctx.fields.find((f) => f.key === t.key)]));
  const sorted = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const violations: Violation[] = [];

  for (const rule of sorted) {
    try {
      for (const violation of rule.validate(ctx)) {
        const targets = violation.targets.filter(
          (target) => !isRuleDisabled(violation.ruleId, fieldOf.get(target.tokenId))
        );
        if (targets.length > 0) violations.push({ ...violation, targets });
      }
    } catch (error) {
      console.warn(`Validation rule "${rule.id}" threw an error and was skipped:`, error);
    }
  }

  return violations;
}

function sameValidation(a: TokenValidation | undefined, b: TokenValidation | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.ruleId === b.ruleId && a.reason === b.reason && a.message === b.message;
}

function toValidation(violation: Violation): TokenValidation {
  const validation: TokenValidation = { ruleId: violation.ruleId, reason: violation.reason };
  if (violation.message !== undefined) validation.message = violation.message;
  return validation;
}

/**
 * Validates the document `next`, which came from `prev`, and decides what to change.
 * Tokens are identified by id throughout, so nothing here depends on where a token was.
 *
 * `prev` is the document the edits are measured from: the one before the
 * transactions being validated, or, while the user is in a token, the one from when
 * they entered it. The tokens added or changed since `prev` are the ones being edited,
 * where the user is does not make a token edited. A token
 * is deleted only when a configured rule asks for it, never while the user is in
 * it, and never as part of an undo or redo. Without configured rules nothing is
 * deleted.
 */
export function planValidation(
  prev: ProseMirrorNode,
  next: ProseMirrorNode,
  input: ValidationInput
): Plan {
  const tokens = collectTokens(next);
  const { added, editing } = editedTokens(prev, tokens, input);
  const ctx: ValidationContext = {
    tokens,
    fields: input.fields,
    editingTokenIds: editing,
    focusedTokenId: input.focusedTokenId,
    isEditing: (token) => editing.has(token.id),
  };
  const violations = runRules([...input.rules, ...input.implicitRules], ctx);

  const present = new Set(tokens.map((t) => t.id));
  const deleted = new Set<string>();
  let undoable = false;
  if (input.rules.length > 0 && !input.isHistoryOperation) {
    // Empty tokens left behind by a cancelled creation are cleaned up silently.
    for (const token of tokens) {
      if (!token.value && token.id !== input.focusedTokenId && !added.has(token.id)) {
        deleted.add(token.id);
      }
    }
    for (const violation of violations) {
      if (violation.action !== 'delete') continue;
      for (const { tokenId } of violation.targets) {
        if (!present.has(tokenId) || tokenId === input.focusedTokenId || deleted.has(tokenId)) {
          continue;
        }
        deleted.add(tokenId);
        undoable = true;
      }
    }
  }

  // The first violation of a token is the one it shows.
  const shown = new Map<string, TokenValidation>();
  for (const violation of violations) {
    for (const { tokenId } of violation.targets) {
      if (!shown.has(tokenId)) shown.set(tokenId, toValidation(violation));
    }
  }

  const changes: ValidationChange[] = [];
  const remaining = new Set<string>();
  for (const token of tokens) {
    if (deleted.has(token.id)) continue;
    remaining.add(token.id);
    const validation = shown.get(token.id);
    if (!sameValidation(input.recorded.get(token.id), validation)) {
      changes.push({ tokenId: token.id, validation });
    }
  }
  for (const tokenId of input.recorded.keys()) {
    if (!remaining.has(tokenId)) changes.push({ tokenId, validation: undefined });
  }

  return { deletions: [...deleted], undoable, changes };
}

function deleteTokens(tr: Transaction, ids: readonly string[]): void {
  const ranges: SpacerExpandedRange[] = [];
  for (const id of ids) {
    const found = findTokenById(tr.doc, id);
    if (found) ranges.push(expandWithSpacers(tr.doc, found.pos, found.node.nodeSize));
  }
  if (ranges.length === 0) return;

  const merged = mergeOverlappingRanges(ranges);
  for (const range of merged) {
    range.needsSpaceSeparator = checkBoundaryNeedsSpace(tr.doc, range.from, range.to);
  }

  // From the end of the document, so deleting one range does not move the next.
  merged.sort((a, b) => b.from - a.from);
  for (const range of merged) {
    applySpacerDeletion(tr, tr.doc.type.schema, range);
  }
}

/**
 * Carries out `plan` on `tr`, whose document must be the one that was validated.
 *
 * @returns whether `tr` now changes the document or token meta
 */
export function applyPlan(tr: Transaction, plan: Plan): boolean {
  deleteTokens(tr, plan.deletions);
  for (const { tokenId, validation } of plan.changes) {
    setTokenMeta(tr, tokenId, { validation });
  }
  if (!plan.undoable) tr.setMeta('addToHistory', false);
  return tr.docChanged || plan.changes.length > 0;
}
