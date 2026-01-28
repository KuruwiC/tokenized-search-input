import type {
  CreateRuleOptions,
  ExtendedValidationFn,
  SimpleToken,
  SimpleValidationFn,
  SimpleValidationReturn,
  ValidationContext,
  ValidationRule,
  ValidationToken,
  Violation,
} from '../types';
import { enumResolvers, getEnumValue, resolveEnumValue } from '../utils/enum-value';
import {
  createDeleteViolation,
  createMarkViolation,
  getNewOrEditingTokens,
  splitByEditState,
} from './strategy-helpers';

// ============================================
// Uniqueness Presets
// ============================================

export type UniqueConstraint = 'key' | 'key-operator' | 'exact';

/**
 * Duplicate group for uniqueness validation.
 */
export interface DuplicateGroup {
  signature: string;
  key: string;
  tokens: ValidationToken[];
}

/**
 * Strategy result specifying which tokens to delete/mark.
 */
export interface StrategyResult {
  delete: ValidationToken[];
  mark: ValidationToken[];
}

/**
 * Strategy for handling duplicate tokens.
 */
export type UniqueStrategy = (group: DuplicateGroup, ctx: ValidationContext) => StrategyResult;

// Signature builders for different token types (functional approach)
type SignatureBuilder = (token: ValidationToken) => string;

const freeTextSignatureBuilders: Record<UniqueConstraint, SignatureBuilder> = {
  key: () => 'freetext:',
  'key-operator': () => 'freetext:',
  exact: (token) => `freetext:${token.value}`,
};

const filterSignatureBuilders: Record<UniqueConstraint, SignatureBuilder> = {
  key: (token) => `filter:${token.key}`,
  'key-operator': (token) => `filter:${token.key}:${token.operator}`,
  exact: (token) => `filter:${token.key}:${token.operator}:${token.value}`,
};

function createSignature(token: ValidationToken, constraint: UniqueConstraint): string {
  const builders = token.type === 'freeText' ? freeTextSignatureBuilders : filterSignatureBuilders;
  return builders[constraint](token);
}

function buildDuplicateGroups(
  tokens: ValidationToken[],
  constraint: UniqueConstraint
): Map<string, DuplicateGroup> {
  return tokens.reduce((groups, token) => {
    const sig = createSignature(token, constraint);
    const existing = groups.get(sig);
    const group = existing ?? { signature: sig, key: token.key, tokens: [] };
    group.tokens.push(token);
    return existing ? groups : groups.set(sig, group);
  }, new Map<string, DuplicateGroup>());
}

// Message builders for each constraint type (functional approach)
const duplicateMessageBuilders: Record<UniqueConstraint, (key: string) => string> = {
  key: (key) => `Only one "${key}" filter is allowed`,
  'key-operator': (key) => `Duplicate "${key}" filter with same operator`,
  exact: () => 'Duplicate filter',
};

const getDuplicateMessage = (constraint: UniqueConstraint, key: string): string =>
  duplicateMessageBuilders[constraint](key);

export interface UniqueOptions {
  priority?: number;
}

/**
 * Strategies and rule factory for handling duplicate tokens.
 * Uses splitByEditState for consistent new/existing separation.
 *
 * @example
 * import { Unique } from '@kuruwic/tokenized-search-input';
 *
 * Unique.rule('key')                    // Mark duplicates
 * Unique.rule('key', Unique.replace)    // Replace existing with new
 * Unique.rule('key', Unique.reject)     // Reject new duplicates
 */
const uniqueMark: UniqueStrategy = (group) => ({
  delete: [],
  mark: group.tokens.slice(1),
});

const uniqueReplace: UniqueStrategy = (group, ctx) => {
  const { newOrEditing, untouched } = splitByEditState(group.tokens, ctx);

  // All existing (e.g., undo/redo): keep last, delete rest
  if (newOrEditing.length === 0) {
    return { delete: group.tokens.slice(0, -1), mark: [] };
  }

  // Has editing tokens: delete existing + keep only last editing
  const editingToDelete = newOrEditing.length > 1 ? newOrEditing.slice(0, -1) : [];
  return {
    delete: [...untouched, ...editingToDelete],
    mark: [],
  };
};

const uniqueReject: UniqueStrategy = (group, ctx) => {
  const newOrEditing = getNewOrEditingTokens(group.tokens, ctx);
  // All editing (e.g., paste): keep first, delete rest
  if (newOrEditing.length === group.tokens.length) {
    return { delete: newOrEditing.slice(1), mark: [] };
  }
  // No editing tokens (defensive): fall back to marking
  if (newOrEditing.length === 0) {
    return { delete: [], mark: group.tokens.slice(1) };
  }
  return { delete: newOrEditing, mark: [] };
};

export const Unique = {
  /**
   * Mark duplicates as invalid (first token survives).
   */
  mark: uniqueMark,

  /**
   * Replace existing tokens with new ones (delete existing, keep last editing).
   */
  replace: uniqueReplace,

  /**
   * Reject new duplicates (delete editing, keep existing).
   */
  reject: uniqueReject,

  /**
   * Creates a uniqueness validation rule.
   *
   * @param constraint - What to compare for uniqueness
   * @param strategy - How to handle duplicates (default: Unique.mark)
   * @param options - Additional options like priority
   */
  rule(
    constraint: UniqueConstraint,
    strategy: UniqueStrategy = uniqueMark,
    options?: UniqueOptions
  ): ValidationRule {
    const ruleId = `unique-${constraint}`;

    return {
      id: ruleId,
      validate: (ctx) => {
        const groups = buildDuplicateGroups(ctx.tokens, constraint);
        const violations: Violation[] = [];

        for (const group of groups.values()) {
          if (group.tokens.length <= 1) continue;

          const result = strategy(group, ctx);
          const message = getDuplicateMessage(constraint, group.key);
          const opts = { ruleId, reason: 'duplicate', message };

          const deleteViolation = createDeleteViolation(result.delete, opts);
          if (deleteViolation) violations.push(deleteViolation);

          const markViolation = createMarkViolation(result.mark, opts);
          if (markViolation) violations.push(markViolation);
        }

        return violations;
      },
      priority: options?.priority,
    };
  },
};

// ============================================
// Count Presets
// ============================================

/**
 * Strategy for handling tokens that exceed the limit.
 * Receives all relevant tokens and the excess count to determine what to delete/mark.
 */
export type MaxCountStrategy = (
  allTokens: ValidationToken[],
  excessCount: number,
  ctx: ValidationContext
) => StrategyResult;

export interface MaxCountOptions {
  priority?: number;
  message?: string;
}

/**
 * Strategies and rule factory for handling tokens that exceed the count limit.
 *
 * @example
 * import { MaxCount } from '@kuruwic/tokenized-search-input';
 *
 * MaxCount.rule('tag', 3)                    // Mark exceeding tags
 * MaxCount.rule('tag', 3, MaxCount.reject)   // Reject new tags that exceed limit
 */
const maxCountMark: MaxCountStrategy = (tokens, excessCount) => ({
  delete: [],
  mark: tokens.slice(-excessCount),
});

const maxCountReject: MaxCountStrategy = (tokens, excessCount, ctx) => {
  const { newOrEditing, untouched } = splitByEditState(tokens, ctx);

  // Prioritize deleting editing tokens
  if (newOrEditing.length >= excessCount) {
    return { delete: newOrEditing.slice(0, excessCount), mark: [] };
  }

  // Not enough editing tokens: delete all editing + some existing from the end
  const remainingToDelete = excessCount - newOrEditing.length;
  return {
    delete: [...newOrEditing, ...untouched.slice(-remainingToDelete)],
    mark: [],
  };
};

export const MaxCount = {
  /**
   * Mark exceeding tokens as invalid (position-based, marks tokens at the end).
   */
  mark: maxCountMark,

  /**
   * Reject (delete) new tokens that would exceed the limit.
   * Prioritizes deleting editing tokens regardless of their position.
   */
  reject: maxCountReject,

  /**
   * Creates a rule that enforces maximum count per field.
   *
   * @param fieldKey - Field key to count ('*' for total)
   * @param max - Maximum allowed count
   * @param strategy - How to handle exceeding tokens (default: MaxCount.mark)
   * @param options - Additional options like priority and message
   */
  rule(
    fieldKey: string,
    max: number,
    strategy: MaxCountStrategy = maxCountMark,
    options?: MaxCountOptions
  ): ValidationRule {
    const ruleId = fieldKey === '*' ? 'max-count-total' : `max-count-${fieldKey}`;
    const effectiveMax = Math.max(0, max);

    return {
      id: ruleId,
      validate: (ctx) => {
        const relevantTokens =
          fieldKey === '*' ? ctx.tokens : ctx.tokens.filter((t) => t.key === fieldKey);

        if (relevantTokens.length <= effectiveMax) {
          return [];
        }

        const defaultMessage =
          fieldKey === '*'
            ? `Maximum ${effectiveMax} filters allowed`
            : `Maximum ${effectiveMax} "${fieldKey}" filters allowed`;

        const excessCount = relevantTokens.length - effectiveMax;
        const result = strategy(relevantTokens, excessCount, ctx);
        const message = options?.message ?? defaultMessage;
        const opts = { ruleId, reason: 'max-exceeded', message };

        const violations: Violation[] = [];
        const deleteViolation = createDeleteViolation(result.delete, opts);
        if (deleteViolation) violations.push(deleteViolation);

        const markViolation = createMarkViolation(result.mark, opts);
        if (markViolation) violations.push(markViolation);

        return violations;
      },
      priority: options?.priority,
    };
  },
};

// ============================================
// Pattern Validation Presets
// ============================================

/**
 * Strategy for handling tokens with invalid values.
 */
export type InvalidValueStrategy = (
  token: ValidationToken,
  ctx: ValidationContext
) => 'delete' | 'mark';

export interface RequirePatternOptions {
  priority?: number;
  message?: string;
}

const invalidValueMark: InvalidValueStrategy = () => 'mark';
const invalidValueReject: InvalidValueStrategy = (token, ctx) =>
  ctx.isEditing(token) ? 'delete' : 'mark';

/**
 * Strategies and rule factory for validating tokens against a regex pattern.
 *
 * @example
 * import { RequirePattern } from '@kuruwic/tokenized-search-input';
 *
 * RequirePattern.rule('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
 * RequirePattern.rule('email', /.../, RequirePattern.reject, { message: 'Invalid email' })
 */
export const RequirePattern = {
  /**
   * Mark invalid tokens.
   */
  mark: invalidValueMark,

  /**
   * Reject (delete) editing tokens with invalid pattern.
   */
  reject: invalidValueReject,

  /**
   * Creates a rule that validates value against a pattern.
   *
   * @param fieldKey - Field key to validate
   * @param regex - Regular expression pattern
   * @param strategy - How to handle invalid tokens (default: RequirePattern.mark)
   * @param options - Additional options like priority and message
   */
  rule(
    fieldKey: string,
    regex: RegExp,
    strategy: InvalidValueStrategy = invalidValueMark,
    options?: RequirePatternOptions
  ): ValidationRule {
    const ruleId = `pattern-${fieldKey}`;

    return {
      id: ruleId,
      validate: (ctx) => {
        const violations: Violation[] = [];

        for (const token of ctx.tokens) {
          if (token.key !== fieldKey) continue;
          if (!token.value) continue;

          if (regex.global || regex.sticky) {
            regex.lastIndex = 0;
          }

          if (!regex.test(token.value)) {
            const action = strategy(token, ctx);
            violations.push({
              ruleId,
              reason: 'pattern',
              message: options?.message ?? `Invalid format for "${fieldKey}"`,
              action,
              targets: [{ tokenId: token.id, pos: token.pos }],
            });
          }
        }

        return violations;
      },
      priority: options?.priority,
    };
  },
};

// ============================================
// Enum Value Validation Presets
// ============================================

export interface RequireEnumOptions {
  priority?: number;
  message?: string;
}

/**
 * Strategies and rule factory for validating enum field values.
 *
 * @example
 * import { RequireEnum } from '@kuruwic/tokenized-search-input';
 *
 * RequireEnum.rule()                      // Mark invalid enum values
 * RequireEnum.rule(RequireEnum.reject)    // Reject new tokens with invalid values
 */
export const RequireEnum = {
  /**
   * Mark invalid tokens.
   */
  mark: invalidValueMark,

  /**
   * Reject (delete) editing tokens with invalid enum value.
   */
  reject: invalidValueReject,

  /**
   * Creates a rule that validates enum field values against defined options.
   *
   * @param strategy - How to handle invalid tokens (default: RequireEnum.mark)
   * @param options - Additional options like priority and message
   */
  rule(
    strategy: InvalidValueStrategy = invalidValueMark,
    options?: RequireEnumOptions
  ): ValidationRule {
    const ruleId = 'enum-value';

    return {
      id: ruleId,
      validate: (ctx) => {
        const violations: Violation[] = [];

        for (const token of ctx.tokens) {
          const field = ctx.fields.find((f) => f.key === token.key);

          if (field?.type !== 'enum' || !field.enumValues) continue;
          if (!token.value) continue;

          // Use the field's resolver (or default) to check validity
          const resolver = field.valueResolver ?? enumResolvers.caseInsensitive;
          const resolved = resolveEnumValue(field.enumValues, token.value, { resolver });

          // If resolved equals input, check if it's actually a valid enum value
          // (resolver returns original input when no match found)
          const isValid =
            resolved !== token.value ||
            field.enumValues.some((ev) => getEnumValue(ev) === token.value);

          if (!isValid) {
            const action = strategy(token, ctx);
            violations.push({
              ruleId,
              reason: 'invalid-enum-value',
              message: options?.message ?? `Invalid value for "${field.label}"`,
              action,
              targets: [{ tokenId: token.id, pos: token.pos }],
            });
          }
        }

        return violations;
      },
      priority: options?.priority,
    };
  },
};

// ============================================
// Custom Rule Helpers
// ============================================

/**
 * Creates a validation rule from a simple function.
 * Hides internal details like pos.
 *
 * Returns Violation[] for each token that fails validation.
 *
 * @example
 * // Basic usage - return error message string (marks token)
 * createRule((token, allTokens) => {
 *   const count = allTokens.filter((t) => t.key === token.key).length;
 *   if (count > 1) {
 *     return `"${token.key}" is already in use`;
 *   }
 * }, { id: 'no-duplicates' });
 *
 * @example
 * // Delete specific tokens
 * createRule((token, allTokens, currentIndex) => {
 *   if (token.key !== 'status') return;
 *   const existingIndices = allTokens
 *     .map((t, i) => (t.key === 'status' && i !== currentIndex ? i : -1))
 *     .filter((i) => i !== -1);
 *   if (existingIndices.length > 0) {
 *     return { deleteTargetIndices: existingIndices };
 *   }
 * }, { id: 'status-replace' });
 */
export function createRule(
  validate: SimpleValidationFn,
  options?: CreateRuleOptions
): ValidationRule;
export function createRule(
  validate: ExtendedValidationFn,
  options?: CreateRuleOptions
): ValidationRule;
export function createRule(
  validate: SimpleValidationFn | ExtendedValidationFn,
  options: CreateRuleOptions = {}
): ValidationRule {
  const { id: ruleId = 'custom-rule', priority } = options;

  return {
    id: ruleId,
    validate: (ctx) => {
      const violations: Violation[] = [];
      const allSimpleTokens: SimpleToken[] = ctx.tokens.map((t) => ({
        key: t.key,
        operator: t.operator,
        value: t.value,
      }));

      for (let i = 0; i < ctx.tokens.length; i++) {
        const token = ctx.tokens[i];
        const simpleToken: SimpleToken = {
          key: token.key,
          operator: token.operator,
          value: token.value,
        };

        const result = (validate as ExtendedValidationFn)(simpleToken, allSimpleTokens, i);

        if (result == null) continue;

        if (typeof result === 'string') {
          // String result = mark the token
          violations.push({
            ruleId,
            reason: 'custom',
            message: result,
            action: 'mark',
            targets: [{ tokenId: token.id, pos: token.pos }],
          });
          continue;
        }

        // Handle deleteTargetIndices
        if (result.deleteTargetIndices && result.deleteTargetIndices.length > 0) {
          const targets = result.deleteTargetIndices
            .filter((idx) => idx >= 0 && idx < ctx.tokens.length)
            .map((idx) => ({ tokenId: ctx.tokens[idx].id, pos: ctx.tokens[idx].pos }));

          if (targets.length > 0) {
            violations.push({
              ruleId,
              reason: 'custom',
              message: result.message,
              action: 'delete',
              targets,
            });
          }
        } else if (result.message) {
          // Has message but no deleteTargetIndices = mark
          violations.push({
            ruleId,
            reason: 'custom',
            message: result.message,
            action: 'mark',
            targets: [{ tokenId: token.id, pos: token.pos }],
          });
        }
      }

      return violations;
    },
    priority,
  };
}

/**
 * Creates a validation rule that applies only to a specific field.
 *
 * @example
 * createFieldRule('email', (value, _allTokens, _operator) => {
 *   if (!value.includes('@')) {
 *     return 'Invalid email format';
 *   }
 * });
 */
export function createFieldRule(
  fieldKey: string,
  validate: (value: string, allTokens: SimpleToken[], operator: string) => SimpleValidationReturn,
  options?: CreateRuleOptions
): ValidationRule {
  return createRule(
    (token, allTokens) => {
      if (token.key !== fieldKey) return null;
      return validate(token.value, allTokens, token.operator);
    },
    {
      id: options?.id ?? `field-rule-${fieldKey}`,
      ...options,
    }
  );
}

// ============================================
// Namespace Export
// ============================================

/**
 * Preset validation rules.
 *
 * @example
 * import { Unique, MaxCount, createRule } from '@kuruwic/tokenized-search-input';
 *
 * <TokenizedSearchEditor
 *   validation={{
 *     rules: [
 *       Unique.rule('key', Unique.replace),
 *       MaxCount.rule('tag', 3, MaxCount.reject),
 *     ]
 *   }}
 * />
 */
export const ValidationRules = {
  unique: Unique.rule,
  maxCount: MaxCount.rule,
  pattern: RequirePattern.rule,
  enumValue: RequireEnum.rule,
  createRule,
  createFieldRule,
};
