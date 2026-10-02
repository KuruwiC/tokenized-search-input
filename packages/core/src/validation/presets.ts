import type {
  CreateRuleOptions,
  ValidationContext,
  ValidationRule,
  ValidationToken,
  Violation,
} from '../types';
import { getEnumValue } from '../utils/enum-value';

/** Which tokens a strategy deletes and which it only marks as invalid. */
interface Outcome {
  delete: ValidationToken[];
  mark: ValidationToken[];
}

interface ViolationBase {
  ruleId: string;
  reason: string;
  message: string;
}

function toViolations(outcome: Outcome, base: ViolationBase): Violation[] {
  const violations: Violation[] = [];
  for (const [action, tokens] of [
    ['delete', outcome.delete],
    ['mark', outcome.mark],
  ] as const) {
    if (tokens.length === 0) continue;
    violations.push({ ...base, action, targets: tokens.map((t) => ({ tokenId: t.id })) });
  }
  return violations;
}

/** Whether the user has finished entering the token: it has a value and they are not in it. */
function isEntered(token: ValidationToken, ctx: ValidationContext): boolean {
  return token.value !== '' && token.id !== ctx.focusedTokenId;
}

/** Whether a reject strategy may delete the token: it was edited and is fully entered. */
function isRejectable(token: ValidationToken, ctx: ValidationContext): boolean {
  return ctx.isEditing(token) && isEntered(token, ctx);
}

// ============================================
// Uniqueness Presets
// ============================================

export type UniqueConstraint = 'key' | 'key-operator' | 'exact';

/**
 * What to do with tokens that duplicate each other:
 * - `'mark'`: mark every duplicate after the first
 * - `'replace'`: the last edited token replaces the others
 * - `'reject'`: delete the edited duplicates and keep the existing token
 */
export type DuplicateStrategy = 'mark' | 'replace' | 'reject';

export interface UniqueOptions {
  /** @default 'mark' */
  onDuplicate?: DuplicateStrategy;
  /** Which failure a token shows when several rules fail it (see `ValidationRule.priority`). */
  priority?: number;
}

/**
 * The text that identifies a token under the constraint. Free text has no key or
 * operator, so only the exact constraint compares it.
 */
function signatureOf(token: ValidationToken, constraint: UniqueConstraint): string | null {
  if (token.type === 'freeText') {
    return constraint === 'exact' ? `freetext:${token.value}` : null;
  }
  switch (constraint) {
    case 'key':
      return `filter:${token.key}`;
    case 'key-operator':
      return `filter:${token.key}:${token.operator}`;
    case 'exact':
      return `filter:${token.key}:${token.operator}:${token.value}`;
  }
}

function duplicateGroups(
  tokens: ValidationToken[],
  constraint: UniqueConstraint
): ValidationToken[][] {
  const groups = new Map<string, ValidationToken[]>();
  for (const token of tokens) {
    const signature = signatureOf(token, constraint);
    if (signature === null) continue;
    const group = groups.get(signature);
    if (group) group.push(token);
    else groups.set(signature, [token]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

const duplicateMessages: Record<UniqueConstraint, (key: string) => string> = {
  key: (key) => `Only one "${key}" filter is allowed`,
  'key-operator': (key) => `Duplicate "${key}" filter with same operator`,
  exact: () => 'Duplicate filter',
};

/**
 * Whether the token newly duplicates the others: it was edited, and it did not exist
 * before, had no value yet, or differs in what the constraint compares.
 */
function isNewDuplicate(
  token: ValidationToken,
  ctx: ValidationContext,
  constraint: UniqueConstraint
): boolean {
  if (!ctx.isEditing(token)) return false;
  const before = ctx.before(token);
  return (
    !before ||
    before.value === '' ||
    signatureOf(before, constraint) !== signatureOf(token, constraint)
  );
}

function resolveDuplicates(
  group: ValidationToken[],
  ctx: ValidationContext,
  constraint: UniqueConstraint,
  strategy: DuplicateStrategy
): Outcome {
  const added = group.filter((t) => isNewDuplicate(t, ctx, constraint));

  // Nothing new joined the group (undo, redo, focus moves): there is no newer token to favour.
  if (strategy === 'mark' || added.length === 0) {
    return { delete: [], mark: strategy === 'replace' ? group.slice(0, -1) : group.slice(1) };
  }

  if (strategy === 'replace') {
    const kept = added[added.length - 1];
    const others = group.filter((t) => t !== kept);
    // The token that replaces the others is still being filled in: wait until it is entered.
    return isEntered(kept, ctx) ? { delete: others, mark: [] } : { delete: [], mark: others };
  }

  // reject: the existing token wins; when every token is new the first one does.
  const existing = group.filter((t) => !added.includes(t));
  const rejected = (existing.length > 0 ? added : added.slice(1)).filter((t) => isEntered(t, ctx));
  const survivors = group.filter((t) => !rejected.includes(t));
  return { delete: rejected, mark: survivors.slice(1) };
}

/**
 * Rule factory for tokens that duplicate each other.
 *
 * @example
 * import { Unique } from '@kuruwic/tokenized-search-input/utils';
 *
 * Unique.rule('key')                                  // Mark duplicates
 * Unique.rule('key', { onDuplicate: 'replace' })      // The newest token replaces the others
 * Unique.rule('key', { onDuplicate: 'reject' })       // Delete new duplicates
 */
export const Unique = {
  /**
   * Creates a uniqueness validation rule.
   *
   * @param constraint - What to compare for uniqueness
   * @param options - How to handle duplicates, and the rule's priority
   */
  rule(constraint: UniqueConstraint, options: UniqueOptions = {}): ValidationRule {
    const ruleId = `unique-${constraint}`;
    const { onDuplicate = 'mark', priority } = options;

    return {
      id: ruleId,
      priority,
      validate: (ctx) =>
        duplicateGroups(ctx.tokens, constraint).flatMap((group) =>
          toViolations(resolveDuplicates(group, ctx, constraint, onDuplicate), {
            ruleId,
            reason: 'duplicate',
            message: duplicateMessages[constraint](group[0].key),
          })
        ),
    };
  },
};

// ============================================
// Count Presets
// ============================================

export interface MaxCountOptions {
  /**
   * What to do with the tokens past the limit: mark the last ones, or delete edited ones.
   * @default 'mark'
   */
  onExceed?: 'mark' | 'reject';
  /** Which failure a token shows when several rules fail it (see `ValidationRule.priority`). */
  priority?: number;
  message?: string;
}

function resolveExcess(
  tokens: ValidationToken[],
  excess: number,
  ctx: ValidationContext,
  strategy: 'mark' | 'reject'
): Outcome {
  if (strategy === 'mark') return { delete: [], mark: tokens.slice(-excess) };

  const rejected = tokens.filter((t) => isRejectable(t, ctx)).slice(-excess);
  const survivors = tokens.filter((t) => !rejected.includes(t));
  const remaining = excess - rejected.length;
  return { delete: rejected, mark: remaining > 0 ? survivors.slice(-remaining) : [] };
}

/**
 * Rule factory for tokens that exceed a count limit.
 *
 * @example
 * import { MaxCount } from '@kuruwic/tokenized-search-input/utils';
 *
 * MaxCount.rule('tag', 3)                           // Mark tags past the third
 * MaxCount.rule('tag', 3, { onExceed: 'reject' })   // Delete new tags past the third
 */
export const MaxCount = {
  /**
   * Creates a rule that enforces maximum count per field.
   *
   * @param fieldKey - Field key to count ('*' for total)
   * @param max - Maximum allowed count
   * @param options - How to handle tokens past the limit, priority and message
   */
  rule(fieldKey: string, max: number, options: MaxCountOptions = {}): ValidationRule {
    const ruleId = fieldKey === '*' ? 'max-count-total' : `max-count-${fieldKey}`;
    const effectiveMax = Math.max(0, max);
    const { onExceed = 'mark', priority } = options;
    const message =
      options.message ??
      (fieldKey === '*'
        ? `Maximum ${effectiveMax} filters allowed`
        : `Maximum ${effectiveMax} "${fieldKey}" filters allowed`);

    return {
      id: ruleId,
      priority,
      validate: (ctx) => {
        const relevantTokens =
          fieldKey === '*' ? ctx.tokens : ctx.tokens.filter((t) => t.key === fieldKey);
        if (relevantTokens.length <= effectiveMax) return [];

        const excess = relevantTokens.length - effectiveMax;
        return toViolations(resolveExcess(relevantTokens, excess, ctx, onExceed), {
          ruleId,
          reason: 'max-exceeded',
          message,
        });
      },
    };
  },
};

// ============================================
// Pattern Validation Presets
// ============================================

export interface RequirePatternOptions {
  /**
   * What to do with a token whose value does not match: mark it, or delete it if it was edited.
   * @default 'mark'
   */
  onInvalid?: 'mark' | 'reject';
  /** Which failure a token shows when several rules fail it (see `ValidationRule.priority`). */
  priority?: number;
  message?: string;
}

function invalidAction(
  token: ValidationToken,
  ctx: ValidationContext,
  strategy: 'mark' | 'reject'
): 'mark' | 'delete' {
  return strategy === 'reject' && isRejectable(token, ctx) ? 'delete' : 'mark';
}

/**
 * Rule factory for validating tokens against a regex pattern.
 *
 * @example
 * import { RequirePattern } from '@kuruwic/tokenized-search-input/utils';
 *
 * RequirePattern.rule('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
 * RequirePattern.rule('email', /.../, { onInvalid: 'reject', message: 'Invalid email' })
 */
export const RequirePattern = {
  /**
   * Creates a rule that validates value against a pattern.
   *
   * @param fieldKey - Field key to validate
   * @param regex - Regular expression pattern
   * @param options - How to handle invalid tokens, priority and message
   */
  rule(fieldKey: string, regex: RegExp, options: RequirePatternOptions = {}): ValidationRule {
    const ruleId = `pattern-${fieldKey}`;
    const { onInvalid = 'mark', priority } = options;
    const message = options.message ?? `Invalid format for "${fieldKey}"`;

    return {
      id: ruleId,
      priority,
      validate: (ctx) => {
        const violations: Violation[] = [];

        for (const token of ctx.tokens) {
          if (token.key !== fieldKey) continue;
          if (!token.value) continue;

          if (regex.global || regex.sticky) {
            regex.lastIndex = 0;
          }

          if (!regex.test(token.value)) {
            violations.push({
              ruleId,
              reason: 'pattern',
              message,
              action: invalidAction(token, ctx, onInvalid),
              targets: [{ tokenId: token.id }],
            });
          }
        }

        return violations;
      },
    };
  },
};

// ============================================
// Enum Value Validation Presets
// ============================================

export interface RequireEnumOptions {
  /**
   * What to do with a token whose value is not an option: mark it, or delete it if it was edited.
   * @default 'mark'
   */
  onInvalid?: 'mark' | 'reject';
  /** Which failure a token shows when several rules fail it (see `ValidationRule.priority`). */
  priority?: number;
  message?: string;
}

/**
 * Rule factory for validating enum field values.
 *
 * @example
 * import { RequireEnum } from '@kuruwic/tokenized-search-input/utils';
 *
 * RequireEnum.rule()                            // Mark invalid enum values
 * RequireEnum.rule({ onInvalid: 'reject' })     // Delete edited tokens with invalid values
 */
export const RequireEnum = {
  /**
   * Creates a rule that validates enum field values against defined options.
   *
   * @param options - How to handle invalid tokens, priority and message
   */
  rule(options: RequireEnumOptions = {}): ValidationRule {
    const ruleId = 'enum-value';
    const { onInvalid = 'mark', priority } = options;

    return {
      id: ruleId,
      priority,
      validate: (ctx) => {
        const violations: Violation[] = [];

        for (const token of ctx.tokens) {
          const field = ctx.fieldOf(token);

          if (field?.type !== 'enum' || !field.enumValues) continue;
          if (!token.value) continue;

          // Values are stored as the option value, so the stored value is what is checked.
          if (!field.enumValues.some((ev) => getEnumValue(ev) === token.value)) {
            violations.push({
              ruleId,
              reason: 'invalid-enum-value',
              message: options.message ?? `Invalid value for "${field.label}"`,
              action: invalidAction(token, ctx, onInvalid),
              targets: [{ tokenId: token.id }],
            });
          }
        }

        return violations;
      },
    };
  },
};

// ============================================
// Custom Rule Helpers
// ============================================

/**
 * Creates a validation rule from a function that checks one token at a time.
 *
 * The function returns the violation (or violations) for the token, or `null` when
 * the token is valid. A violation names the tokens it is about, which need not
 * include the token being checked.
 *
 * @example
 * // Mark a token
 * createRule('no-deleted-status', (token) =>
 *   token.key === 'status' && token.value === 'deleted'
 *     ? {
 *         ruleId: 'no-deleted-status',
 *         reason: 'forbidden-value',
 *         message: 'Cannot use "deleted" status',
 *         action: 'mark',
 *         targets: [{ tokenId: token.id }],
 *       }
 *     : null
 * );
 *
 * @example
 * // Delete the other status tokens when one was edited
 * createRule('status-replace', (token, ctx) => {
 *   if (token.key !== 'status' || !ctx.isEditing(token)) return null;
 *   const others = ctx.tokens.filter((t) => t.key === 'status' && t.id !== token.id);
 *   return others.length === 0
 *     ? null
 *     : {
 *         ruleId: 'status-replace',
 *         reason: 'replaced',
 *         action: 'delete',
 *         targets: others.map((t) => ({ tokenId: t.id })),
 *       };
 * });
 */
export function createRule(
  id: string,
  validate: (token: ValidationToken, ctx: ValidationContext) => Violation | Violation[] | null,
  options: CreateRuleOptions = {}
): ValidationRule {
  return {
    id,
    priority: options.priority,
    validate: (ctx) =>
      ctx.tokens.flatMap((token) => {
        const result = validate(token, ctx);
        if (result === null || result === undefined) return [];
        return Array.isArray(result) ? result : [result];
      }),
  };
}

/**
 * Creates a validation rule that checks only the tokens of one field.
 *
 * @example
 * createFieldRule('age', (token) =>
 *   Number.isInteger(Number(token.value))
 *     ? null
 *     : {
 *         ruleId: 'field-rule-age',
 *         reason: 'not-an-integer',
 *         message: 'Age must be a whole number',
 *         action: 'mark',
 *         targets: [{ tokenId: token.id }],
 *       }
 * );
 */
export function createFieldRule(
  fieldKey: string,
  validate: (token: ValidationToken, ctx: ValidationContext) => Violation | Violation[] | null,
  options: CreateRuleOptions & { id?: string } = {}
): ValidationRule {
  const { id = `field-rule-${fieldKey}`, ...ruleOptions } = options;
  return createRule(
    id,
    (token, ctx) => (token.key === fieldKey ? validate(token, ctx) : null),
    ruleOptions
  );
}
