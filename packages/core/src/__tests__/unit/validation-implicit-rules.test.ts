import { describe, expect, it } from 'vitest';
import { DATE_VALUE_RULE_ID } from '../../plugins/validation/date-value-rule';
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

describe('implicit validation of dates', () => {
  const dateField: FieldDefinition = {
    key: 'due',
    label: 'Due',
    type: 'date',
    operators: ['is'],
  };
  const datetimeField: FieldDefinition = {
    key: 'at',
    label: 'At',
    type: 'datetime',
    operators: ['is'],
  };

  const violationsFor = (field: FieldDefinition, value: string) => {
    const rules = createImplicitRules({ fields: [field], unknownFields: undefined });
    const ctx: ValidationContext = {
      tokens: [
        { id: 't1', type: 'filter', key: field.key, operator: 'is', value, rawValue: value },
      ],
      fields: [field],
      editingTokenIds: new Set(),
      focusedTokenId: null,
      isEditing: () => false,
      before: () => undefined,
      fieldOf: () => field,
    };
    return rules.flatMap((rule) => rule.validate(ctx));
  };

  it('include a rule for dates', () => {
    const rules = createImplicitRules({ fields: [dateField], unknownFields: undefined });
    expect(rules.map((rule) => rule.id)).toContain(DATE_VALUE_RULE_ID);
  });

  it.each(['2024-03-05', '2024-03-05T10:00'])('accept the date %s', (value) => {
    expect(violationsFor(dateField, value)).toEqual([]);
  });

  it.each([
    '2024',
    '2024-03',
    '20240305',
    '2024-02-31',
    '2024-3-5',
    'soon',
  ])('mark the date %s', (value) => {
    expect(violationsFor(dateField, value)).toEqual([
      {
        ruleId: DATE_VALUE_RULE_ID,
        reason: 'invalid-value',
        message: 'Invalid date format',
        action: 'mark',
        targets: [{ tokenId: 't1' }],
      },
    ]);
  });

  it.each([
    '2024-03-05',
    '2024-03-05T14:30',
    '2024-03-05 14:30:00',
    '2024-03-05T14:30:00+0900',
    '2024-03-05T14:30:45.123Z',
  ])('accept the datetime %s', (value) => {
    expect(violationsFor(datetimeField, value)).toEqual([]);
  });

  it.each([
    '2024',
    '2024-02-31',
    '2024-03-05T25:00',
    '2024-03-05T14',
    '2024-03-05T14:30+25:00',
  ])('mark the datetime %s', (value) => {
    expect(violationsFor(datetimeField, value)).toEqual([
      {
        ruleId: DATE_VALUE_RULE_ID,
        reason: 'invalid-value',
        message: 'Invalid datetime format',
        action: 'mark',
        targets: [{ tokenId: 't1' }],
      },
    ]);
  });

  it('ignore an empty value', () => {
    expect(violationsFor(dateField, '')).toEqual([]);
  });

  it('use the parse of the field', () => {
    const field: FieldDefinition = {
      ...dateField,
      formatConfig: { parse: (input) => (input === 'today' ? { date: '2024-03-05' } : null) },
    };
    expect(violationsFor(field, 'today')).toEqual([]);
    expect(violationsFor(field, '2024-03-05')).toHaveLength(1);
  });

  it('do not check a string field', () => {
    expect(violationsFor({ ...emailField, validate: undefined }, '2024')).toEqual([]);
  });
});
