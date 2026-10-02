import { parseDateFieldValue } from '../../pickers/date-format';
import type { ValidationRule, Violation } from '../../types';
import { type FieldResolutionSource, resolveField } from '../../utils/resolve-field';

export const DATE_VALUE_RULE_ID = 'date-value';

/**
 * The implicit rule every `date` and `datetime` field has: it marks each filter token
 * whose value the date parser of the field rejects, so a partial date such as `2024`
 * or a date that does not exist such as `2024-02-31` is shown as invalid. Like any
 * rule, it can be disabled per field with `validation: { 'date-value': false }`.
 */
export function createDateValueRule(source: FieldResolutionSource): ValidationRule {
  return {
    id: DATE_VALUE_RULE_ID,
    validate: (ctx) => {
      const violations: Violation[] = [];
      for (const token of ctx.tokens) {
        if (token.type !== 'filter' || !token.value) continue;
        const field = resolveField(source, token.key);
        if (field?.type !== 'date' && field?.type !== 'datetime') continue;
        const parsed = parseDateFieldValue(token.value, field);
        if (parsed.ok) continue;
        violations.push({
          ruleId: DATE_VALUE_RULE_ID,
          reason: 'invalid-value',
          message: parsed.error,
          action: 'mark',
          targets: [{ tokenId: token.id }],
        });
      }
      return violations;
    },
  };
}
