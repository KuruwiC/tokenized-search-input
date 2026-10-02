import type { ValidationRule } from '../../types';
import type { FieldResolutionSource } from '../../utils/resolve-field';
import { createFieldValidateRule } from './field-validate-rule';

/**
 * The rules that run on every validation pass, whether or not the application
 * configured any. They only mark tokens; a field can switch one off with
 * `validation: { [ruleId]: false }`. Adding a check that always applies means adding
 * its rule here.
 */
export function createImplicitRules(source: FieldResolutionSource): ValidationRule[] {
  return [createFieldValidateRule(source)];
}
