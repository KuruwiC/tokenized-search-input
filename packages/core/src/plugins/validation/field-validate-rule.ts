import type { ValidationRule, Violation } from '../../types';
import { type FieldResolutionSource, resolveField } from '../../utils/resolve-field';

export const FIELD_VALIDATE_RULE_ID = 'field-validate';

/**
 * The implicit rule behind `FieldDefinition.validate`. It runs on every validation
 * pass, with or without configured rules, and marks each filter token whose value
 * the field's `validate` rejects. A string result becomes the violation message.
 * Like any rule, it can be disabled per field with `validation: { 'field-validate': false }`.
 */
export function createFieldValidateRule(source: FieldResolutionSource): ValidationRule {
  return {
    id: FIELD_VALIDATE_RULE_ID,
    validate: (ctx) => {
      const violations: Violation[] = [];
      for (const token of ctx.tokens) {
        if (token.type !== 'filter' || !token.value) continue;
        const validate = resolveField(source, token.key)?.validate;
        if (!validate) continue;
        const result = validate(token.value);
        if (result === true) continue;
        violations.push({
          ruleId: FIELD_VALIDATE_RULE_ID,
          reason: 'invalid-value',
          message: typeof result === 'string' && result !== '' ? result : undefined,
          action: 'mark',
          targets: [{ tokenId: token.id, pos: token.pos }],
        });
      }
      return violations;
    },
  };
}
