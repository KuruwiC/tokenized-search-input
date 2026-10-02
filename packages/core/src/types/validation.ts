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
   * IDs of the tokens being edited: those the user added, or changed in key,
   * operator or value, in the transactions being validated, and, while the user
   * is in a token, those they added or changed since they entered it. Moving focus,
   * undo and redo, and replacing the whole content do not make a token edited, and
   * neither does a later pass for a token the application updated. A change to the
   * rules edits nothing. The initial content counts as entered at once, so every
   * token is edited then.
   */
  editingTokenIds: Set<string>;
  /** ID of the token the user is in right now, if any. */
  focusedTokenId: string | null;
  /** Whether the token is being edited (see `editingTokenIds`). */
  isEditing: (token: ValidationToken) => boolean;
  /**
   * The token as it was before the edits being validated, for a token that existed
   * then and is being edited. `undefined` for a token the edits added, and for one
   * that is not being edited.
   */
  before: (token: ValidationToken) => ValidationToken | undefined;
  /** The field the token belongs to, `null` for free text and for a key that no field defines. */
  fieldOf: (token: ValidationToken) => FieldDefinition | null;
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
