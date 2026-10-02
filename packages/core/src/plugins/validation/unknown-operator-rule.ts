import type { ValidationRule, Violation } from '../../types';
import { type FieldResolutionSource, resolveField } from '../../utils/resolve-field';

export const UNKNOWN_OPERATOR_RULE_ID = 'unknown-operator';

/**
 * The implicit rule that marks a filter token whose operator its field does not allow.
 * A query can carry such a token, for example `status:contains:foo` on a field without
 * `contains`, and the parser keeps what was written instead of changing it. Like any
 * rule, it can be disabled per field with `validation: { 'unknown-operator': false }`.
 */
export function createUnknownOperatorRule(source: FieldResolutionSource): ValidationRule {
  return {
    id: UNKNOWN_OPERATOR_RULE_ID,
    validate: (ctx) => {
      const violations: Violation[] = [];
      for (const token of ctx.tokens) {
        if (token.type !== 'filter' || !token.value) continue;
        const field = resolveField(source, token.key);
        if (!field || (field.operators as readonly string[]).includes(token.operator)) continue;
        violations.push({
          ruleId: UNKNOWN_OPERATOR_RULE_ID,
          reason: 'unknown-operator',
          message: `Operator "${token.operator}" is not available for ${field.label}`,
          action: 'mark',
          targets: [{ tokenId: token.id }],
        });
      }
      return violations;
    },
  };
}
