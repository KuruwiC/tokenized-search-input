/**
 * Token Attribute Reducer
 *
 * Pure reducer for token attribute state transitions.
 * Centralizes invariants to prevent inconsistent state.
 */

/**
 * Actions for token attribute state transitions.
 * Each action is single-purpose for composability.
 */
export type TokenAttrAction =
  | { type: 'VALUE_CHANGED'; value: string }
  | { type: 'OPERATOR_CHANGED'; operator: string }
  | { type: 'FIELD_CHANGED'; key: string; operator: string }
  | { type: 'CONFIRM' }
  | { type: 'MARK_IMMUTABLE' }
  | { type: 'RESET_DECORATION' };

/**
 * Subset of attrs managed by this reducer.
 * Other attrs (id, fieldLabel) are managed elsewhere.
 */
export interface TokenEditableAttrs {
  value: string;
  operator: string;
  key: string;
  confirmed: boolean;
  immutable: boolean;
  invalid: boolean;
  displayValue: string | null;
  startContent: React.ReactNode | null;
  endContent: React.ReactNode | null;
}

/**
 * Pure reducer for token attribute transitions.
 * Given current attrs and an action, returns the next attrs.
 *
 * Design:
 * - Takes current state as first argument for state-dependent logic
 * - Returns complete attrs object (not a patch) for predictability
 * - Single-purpose actions for composability
 */
export function tokenAttrReducer(
  current: TokenEditableAttrs,
  action: TokenAttrAction
): TokenEditableAttrs {
  switch (action.type) {
    case 'VALUE_CHANGED':
      return {
        ...current,
        value: action.value,
        confirmed: false,
        invalid: false,
        displayValue: null,
        startContent: null,
        endContent: null,
      };

    case 'OPERATOR_CHANGED':
      return {
        ...current,
        operator: action.operator,
        confirmed: false,
      };

    case 'FIELD_CHANGED':
      return {
        ...current,
        key: action.key,
        operator: action.operator,
        confirmed: false,
        immutable: false,
        displayValue: null,
        startContent: null,
        endContent: null,
      };

    case 'CONFIRM':
      return {
        ...current,
        confirmed: true,
      };

    case 'MARK_IMMUTABLE':
      return {
        ...current,
        confirmed: true,
        immutable: true,
      };

    case 'RESET_DECORATION':
      return {
        ...current,
        displayValue: null,
        startContent: null,
        endContent: null,
      };
  }
}

/**
 * Helper to compute attrs patch for updateAttributes.
 * Only includes changed fields to minimize transaction overhead.
 */
export function computeAttrsPatch(
  current: TokenEditableAttrs,
  next: TokenEditableAttrs
): Partial<TokenEditableAttrs> {
  const patch: Partial<TokenEditableAttrs> = {};

  for (const key of Object.keys(next) as (keyof TokenEditableAttrs)[]) {
    if (current[key] !== next[key]) {
      (patch as Record<string, unknown>)[key] = next[key];
    }
  }

  return patch;
}
