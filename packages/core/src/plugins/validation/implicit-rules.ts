import type { ValidationRule } from '../../types';
import type { FieldResolutionSource } from '../../utils/resolve-field';
import { createDateValueRule } from './date-value-rule';
import { createFieldValidateRule } from './field-validate-rule';
import { createUnknownOperatorRule } from './unknown-operator-rule';

/**
 * The rules that run whether or not the application configured any. They only mark
 * tokens, and a field can switch one off with `validation: { [ruleId]: false }`.
 */
export function createImplicitRules(source: FieldResolutionSource): ValidationRule[] {
  return [
    createFieldValidateRule(source),
    createDateValueRule(source),
    createUnknownOperatorRule(source),
  ];
}
