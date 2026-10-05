import type { ValidationRule } from '../../types';
import { type FieldResolutionSource, resolveField } from '../../utils/resolve-field';
import { createRule } from '../../validation/presets';

export const UNKNOWN_OPERATOR_RULE_ID = 'unknown-operator';

/**
 * Marks a filter token whose operator its field does not allow, such as `status:contains:foo`
 * on a field without `contains`; the parser keeps what was written. Disable it per field with
 * `validation: { 'unknown-operator': false }`.
 */
export function createUnknownOperatorRule(source: FieldResolutionSource): ValidationRule {
  return createRule(UNKNOWN_OPERATOR_RULE_ID, (token) => {
    if (token.type !== 'filter' || !token.value) return null;
    const field = resolveField(source, token.key);
    if (!field || (field.operators as readonly string[]).includes(token.operator)) return null;
    return {
      ruleId: UNKNOWN_OPERATOR_RULE_ID,
      reason: 'unknown-operator',
      message: `Operator "${token.operator}" is not available for ${field.label}`,
      action: 'mark',
      targets: [{ tokenId: token.id }],
    };
  });
}
