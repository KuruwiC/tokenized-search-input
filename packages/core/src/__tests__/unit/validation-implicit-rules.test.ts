import { describe, expect, it } from 'vitest';
import { FIELD_VALIDATE_RULE_ID } from '../../plugins/validation/field-validate-rule';
import { createImplicitRules } from '../../plugins/validation/implicit-rules';
import type { FieldDefinition, ValidationContext } from '../../types';

const emailField: FieldDefinition = {
  key: 'email',
  label: 'Email',
  type: 'string',
  operators: ['is'],
  validate: (value) => value.includes('@') || 'Must contain @',
};

const contextOf = (value: string): ValidationContext => ({
  tokens: [{ id: 't1', type: 'filter', key: 'email', operator: 'is', value, rawValue: value }],
  fields: [emailField],
  editingTokenIds: new Set(),
  focusedTokenId: null,
  isEditing: () => false,
  before: () => undefined,
  fieldOf: () => emailField,
});

describe('implicit validation rules', () => {
  const rules = createImplicitRules({ fields: [emailField], unknownFields: undefined });

  it('include the rule behind FieldDefinition.validate', () => {
    expect(rules.map((rule) => rule.id)).toContain(FIELD_VALIDATE_RULE_ID);
  });

  it('mark a value the field rejects, with the field message, and nothing else', () => {
    const violations = rules.flatMap((rule) => rule.validate(contextOf('nope')));
    expect(violations).toEqual([
      {
        ruleId: FIELD_VALIDATE_RULE_ID,
        reason: 'invalid-value',
        message: 'Must contain @',
        action: 'mark',
        targets: [{ tokenId: 't1' }],
      },
    ]);
  });

  it('accept a value the field accepts', () => {
    expect(rules.flatMap((rule) => rule.validate(contextOf('a@b.c')))).toEqual([]);
  });
});
