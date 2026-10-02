import type { FieldDefinition } from './fields';

export type TokenType = 'filter' | 'freeText';

export interface ValidationToken {
  id: string;
  type: TokenType;
  key: string;
  operator: string;
  value: string;
  rawValue: string;
}

export interface ValidationContext {
  tokens: ValidationToken[];
  fields: FieldDefinition[];
  /**
   * IDs of the tokens that were added, or whose key, operator or value changed,
   * in the transactions being validated. Moving focus does not make a token
   * edited. When the whole content is validated at once (initial value,
   * `setValue`, changed rules) every token counts as edited.
   */
  editingTokenIds: Set<string>;
  /** ID of the token the user is in right now, if any. */
  focusedTokenId: string | null;
  /** Whether the token was edited in the transactions being validated. */
  isEditing: (token: ValidationToken) => boolean;
}

/** A token that a violation is about. */
export interface ViolationTarget {
  tokenId: string;
}

/**
 * Action when validation fails:
 * - 'mark': Mark with invalid style
 * - 'delete': Delete the invalid token
 */
export type ValidationAction = 'mark' | 'delete';

/** A validation failure and the tokens it is about. */
export interface Violation {
  ruleId: string;
  /** Machine-readable cause, such as `duplicate` or `pattern`. */
  reason: string;
  /** Text to show for the failure. */
  message?: string;
  action: ValidationAction;
  targets: ViolationTarget[];
}

export interface ValidationRule {
  id: string;
  /**
   * Decides which failure a token shows when it has several: the violation of the
   * rule with the highest priority wins, and rules of equal priority win in the
   * order they are configured. Defaults to 0.
   */
  priority?: number;
  validate(ctx: ValidationContext): Violation[];
}

export interface ValidationConfig {
  /** Rules to run in addition to the ones that always apply, such as `FieldDefinition.validate`. */
  rules?: ValidationRule[];
}

/**
 * Options for `createRule()`.
 */
export interface CreateRuleOptions {
  /** Which failure a token shows when several rules fail it (see `ValidationRule.priority`). */
  priority?: number;
}
