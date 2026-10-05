import type { ValidationRule } from '../../types';
import { type FieldResolutionSource, resolveField } from '../../utils/resolve-field';
import { createRule } from '../../validation/presets';

export const FIELD_VALIDATE_RULE_ID = 'field-validate';

/**
 * The implicit rule behind `FieldDefinition.validate`. It runs on every validation
 * pass, with or without configured rules, and marks each filter token whose value
 * the field's `validate` rejects. A string result becomes the violation message.
 * Like any rule, it can be disabled per field with `validation: { 'field-validate': false }`.
 */
export function createFieldValidateRule(source: FieldResolutionSource): ValidationRule {
  return createRule(FIELD_VALIDATE_RULE_ID, (token) => {
    if (token.type !== 'filter' || !token.value) return null;
    const validate = resolveField(source, token.key)?.validate;
    if (!validate) return null;
    const result = validate(token.value);
    if (result === true) return null;
    return {
      ruleId: FIELD_VALIDATE_RULE_ID,
      reason: 'invalid-value',
      message: typeof result === 'string' && result !== '' ? result : undefined,
      action: 'mark',
      targets: [{ tokenId: token.id }],
    };
  });
}
