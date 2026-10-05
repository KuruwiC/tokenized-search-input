import { closeHistory } from '@tiptap/pm/history';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import type {
  FieldDefinition,
  ValidationContext,
  ValidationRule,
  ValidationToken,
  Violation,
} from '../../types';
import { findTokenById } from '../../utils/find-token';
import { isFilterToken, isFreeTextToken } from '../../utils/node-predicates';
import { type FieldResolutionSource, resolveField } from '../../utils/resolve-field';
import { ensureTokenId } from '../../utils/token-id';
import { setTokenMeta, type TokenValidation, withoutHistory } from '../shared/meta';

function collectTokens(doc: ProseMirrorNode): ValidationToken[] {
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

/**
 * The tokens a user edited, each as it was before its first edit, or `null` when the
 * edit added it.
 */
export type Edits = ReadonlyMap<string, ValidationToken | null>;

export interface ValidationInput {
  /** Decides which field a token's key refers to. */
  source: FieldResolutionSource;
  /** The rules the application configured. Only they may delete tokens. */
  rules: readonly ValidationRule[];
  /** Rules that run whether or not any are configured. They only mark. */
  implicitRules: readonly ValidationRule[];
  focusedTokenId: string | null;
  /**
   * What the user edited since they entered the token they are in. A token typed
   * into over several transactions stays edited until they leave it.
   */
  sessionEdits: Edits;
  /** The whole content was just entered, so every token counts as edited. */
  contentEntered: boolean;
  /** The change is an undo or redo, which never deletes tokens. */
  isHistoryOperation: boolean;
  /** The transactions being validated changed the document in a way undo reverts. */
  recordsHistory: boolean;
  /** The validation token meta holds now, by token id. */
  recorded: ReadonlyMap<string, TokenValidation>;
}

interface ValidationChange {
  tokenId: string;
  /** `undefined` clears the token's validation. */
  validation: TokenValidation | undefined;
}

/** What to do to the document and to token meta after validating it. */
export interface Plan {
  /** Tokens a rule asked to delete; undo reverts their deletion. */
  deletions: readonly string[];
  /** Whether undo reverts the deletions on their own, not together with the edit that led to them. */
  ownUndoStep: boolean;
  /** Token meta writes for the tokens that remain, and for those that left. */
  changes: readonly ValidationChange[];
}

type Fingerprint = Pick<ValidationToken, 'key' | 'operator' | 'value'>;

function sameContent(a: Fingerprint, b: Fingerprint): boolean {
  return a.key === b.key && a.operator === b.operator && a.value === b.value;
}

/**
 * The tokens of `next` that are not in `prev`, as `null`, and those that differ
 * from their counterpart in `prev`, as that counterpart.
 */
function diffTokens(
  prev: ValidationToken[],
  next: ValidationToken[]
): Map<string, ValidationToken | null> {
  const before = new Map(prev.map((t) => [t.id, t]));
  const edits = new Map<string, ValidationToken | null>();
  for (const token of next) {
    const old = before.get(token.id);
    if (!old) edits.set(token.id, null);
    else if (!sameContent(old, token)) edits.set(token.id, old);
  }
  return edits;
}

/**
 * `edits` with what changed from the document `prev` to `next` added: a token that
 * was already edited keeps the content it had before its first edit.
 */
export function recordEdits(edits: Edits, prev: ProseMirrorNode, next: ProseMirrorNode): Edits {
  const changes = diffTokens(collectTokens(prev), collectTokens(next));
  let recorded: Map<string, ValidationToken | null> | null = null;
  for (const [id, before] of changes) {
    if (edits.has(id)) continue;
    recorded ??= new Map(edits);
    recorded.set(id, before);
  }
  return recorded ?? edits;
}

interface EditedTokens {
  editing: Set<string>;
  /** The edited tokens that existed before, as they were. */
  before: Map<string, ValidationToken>;
}

function editedTokens(
  prev: ProseMirrorNode,
  next: ValidationToken[],
  input: ValidationInput
): EditedTokens {
  // Restored by undo or redo, so nothing counts as entered.
  if (input.isHistoryOperation) return { editing: new Set(), before: new Map() };

  const group = diffTokens(collectTokens(prev), next);
  if (input.contentEntered) {
    return { editing: new Set(next.map((t) => t.id)), before: new Map() };
  }

  const present = new Set(next.map((t) => t.id));
  const origins = new Map<string, ValidationToken | null>(group);
  for (const [id, before] of input.sessionEdits) {
    if (present.has(id)) origins.set(id, before);
  }
  const before = new Map<string, ValidationToken>();
  for (const [id, token] of origins) {
    if (token) before.set(id, token);
  }
  return { editing: new Set(origins.keys()), before };
}

function isRuleDisabled(ruleId: string, field: FieldDefinition | null): boolean {
  return field?.validation?.[ruleId] === false;
}

/** The violations of every rule, from the highest priority to the lowest. */
function runRules(rules: readonly ValidationRule[], ctx: ValidationContext): Violation[] {
  const fieldOf = new Map(ctx.tokens.map((t) => [t.id, ctx.fieldOf(t)]));
  const sorted = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const violations: Violation[] = [];

  for (const rule of sorted) {
    try {
      for (const violation of rule.validate(ctx)) {
        const targets = violation.targets.filter(
          (target) => !isRuleDisabled(violation.ruleId, fieldOf.get(target.tokenId) ?? null)
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

function contextFor(
  tokens: ValidationToken[],
  editing: Set<string>,
  before: Map<string, ValidationToken>,
  input: ValidationInput
): ValidationContext {
  return {
    tokens,
    fields: [...input.source.fields],
    editingTokenIds: editing,
    focusedTokenId: input.focusedTokenId,
    isEditing: (token) => editing.has(token.id),
    before: (token) => (editing.has(token.id) ? before.get(token.id) : undefined),
    fieldOf: (token) => (token.type === 'freeText' ? null : resolveField(input.source, token.key)),
  };
}

/**
 * Validates the document `next`, which came from `prev`, and decides what to change.
 * Tokens are identified by id throughout, so nothing here depends on where a token was.
 *
 * A token is edited when it was added or changed in `next` relative to `prev`, or
 * is in `input.sessionEdits`. Where the user is does not make a token edited. A
 * token is deleted only when a configured rule asks for it, never while the user is
 * in it, and never as part of an undo or redo. Without configured rules nothing is
 * deleted. After deleting, the marks of the tokens that remain are decided by
 * running the rules again on those tokens alone, with nothing edited.
 */
export function planValidation(
  prev: ProseMirrorNode,
  next: ProseMirrorNode,
  input: ValidationInput
): Plan {
  const tokens = collectTokens(next);
  const { editing, before } = editedTokens(prev, tokens, input);
  const rules = [...input.rules, ...input.implicitRules];
  let violations = runRules(rules, contextFor(tokens, editing, before, input));

  const present = new Set(tokens.map((t) => t.id));
  const deleted = new Set<string>();
  if (input.rules.length > 0 && !input.isHistoryOperation) {
    for (const violation of violations) {
      if (violation.action !== 'delete') continue;
      for (const { tokenId } of violation.targets) {
        if (!present.has(tokenId) || tokenId === input.focusedTokenId || deleted.has(tokenId)) {
          continue;
        }
        deleted.add(tokenId);
      }
    }
  }

  // Marks computed with the deleted tokens present may no longer apply.
  if (deleted.size > 0) {
    const remaining = tokens.filter((t) => !deleted.has(t.id));
    violations = runRules(rules, contextFor(remaining, new Set(), new Map(), input));
  }

  // The first violation of a token is the one it shows.
  const shown = new Map<string, TokenValidation>();
  for (const violation of violations) {
    for (const { tokenId } of violation.targets) {
      if (!shown.has(tokenId)) shown.set(tokenId, toValidation(violation));
    }
  }

  const changes: ValidationChange[] = [];
  const kept = new Set<string>();
  for (const token of tokens) {
    if (deleted.has(token.id)) continue;
    kept.add(token.id);
    const validation = shown.get(token.id);
    if (!sameValidation(input.recorded.get(token.id), validation)) {
      changes.push({ tokenId: token.id, validation });
    }
  }
  for (const tokenId of input.recorded.keys()) {
    if (!kept.has(tokenId)) changes.push({ tokenId, validation: undefined });
  }

  return {
    deletions: [...deleted],
    ownUndoStep: deleted.size > 0 && !input.recordsHistory,
    changes,
  };
}

function deleteTokens(tr: Transaction, ids: readonly string[]): void {
  for (const id of ids) {
    const found = findTokenById(tr.doc, id);
    if (found) tr.delete(found.pos, found.pos + found.node.nodeSize);
  }
}

/**
 * Carries out `plan` on `tr`, whose document must be the one that was validated.
 *
 * A deletion that no edit led to, such as one on leaving a token, is its own undo step.
 *
 * @returns whether `tr` now changes the document or token meta
 */
export function applyPlan(tr: Transaction, plan: Plan): boolean {
  deleteTokens(tr, plan.deletions);
  for (const { tokenId, validation } of plan.changes) {
    setTokenMeta(tr, tokenId, { validation });
  }
  if (plan.ownUndoStep) closeHistory(tr);
  if (plan.deletions.length === 0) withoutHistory(tr);
  return tr.docChanged || plan.changes.length > 0;
}
