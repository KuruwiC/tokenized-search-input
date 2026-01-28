import type { FieldDefinition } from './fields';

export type TokenType = 'filter' | 'freeText';

export interface ValidationToken {
  id: string;
  type: TokenType;
  pos: number;
  key: string;
  operator: string;
  value: string;
  rawValue: string;
}

export interface ValidationContext {
  tokens: ValidationToken[];
  fields: FieldDefinition[];
  /**
   * IDs of tokens currently being edited.
   * Includes: newly created tokens, modified tokens (key/operator/value),
   * and tokens involved in focus transitions (focused or just-blurred).
   */
  editingTokenIds: Set<string>;
  /** Helper to check if a token is being edited */
  isEditing: (token: ValidationToken) => boolean;
}

/**
 * Target of a validation violation.
 */
export interface ViolationTarget {
  tokenId: string;
  pos: number;
}

/**
 * A validation violation returned by a validator.
 * Validators explicitly specify which tokens are invalid.
 */
export interface Violation {
  ruleId: string;
  reason: string;
  message?: string;
  action: ValidationAction;
  targets: ViolationTarget[];
}

/**
 * Result from a validation rule.
 * Returns Violation[] with explicit targets.
 */
export type ValidationResult = Violation[];

/**
 * Action when validation fails:
 * - 'mark': Mark with invalid style
 * - 'delete': Delete the invalid token
 */
export type ValidationAction = 'mark' | 'delete';

/**
 * Validation rule function.
 * Returns Violation[] with explicit invalid targets.
 */
export type ValidationRuleFn = (ctx: ValidationContext) => ValidationResult;

export interface ValidationRule {
  id: string;
  validate: ValidationRuleFn;
  priority?: number;
}

/**
 * Field-level rule override:
 * - false: Disable rule for this field
 */
export type FieldRuleOverride = false;

export interface ValidationConfig {
  rules?: ValidationRule[];
}

/** Simplified token for createRule() helper (without pos, rawValue). */
export interface SimpleToken {
  key: string;
  operator: string;
  value: string;
}

/**
 * Extended validation result with delete target support.
 * Use deleteTargetIndices to specify which tokens to delete.
 */
export interface ExtendedValidationResult {
  /** Error message to display */
  message?: string;
  /** Indices in allTokens array to delete */
  deleteTargetIndices?: number[];
}

/**
 * Return value for simple validation functions.
 * - string: Error message (marks token as invalid)
 * - null/undefined: Valid (or skip validation)
 * - ExtendedValidationResult: For specifying delete targets
 */
export type SimpleValidationReturn = string | ExtendedValidationResult | null | undefined;

/**
 * Simple validation function for basic use cases.
 * Return an error message string if invalid, or null/undefined if valid.
 *
 * @example
 * // Return error message string
 * (token) => token.value === 'bad' ? 'Invalid value' : null
 *
 * // Return null or undefined for valid
 * (token) => { if (isValid(token)) return null; return 'Error'; }
 */
export type SimpleValidationFn = (
  token: SimpleToken,
  allTokens: SimpleToken[]
) => SimpleValidationReturn;

/**
 * Extended validation function with currentIndex for specifying delete targets.
 */
export type ExtendedValidationFn = (
  token: SimpleToken,
  allTokens: SimpleToken[],
  currentIndex: number
) => SimpleValidationReturn;

/**
 * Options for createRule() helper.
 */
export interface CreateRuleOptions {
  /** Rule ID (default: 'custom-rule') */
  id?: string;
  /** Rule priority (higher values run first) */
  priority?: number;
}
