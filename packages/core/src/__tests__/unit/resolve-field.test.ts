import { describe, expect, it } from 'vitest';
import { resolveField } from '../../extensions/editor-context';
import { DEFAULT_OPERATORS, type FieldDefinition } from '../../types';

const status: FieldDefinition = {
  key: 'status',
  label: 'Status',
  type: 'enum',
  operators: ['is', 'is_not'],
  enumValues: ['open', 'closed'],
};

describe('resolveField', () => {
  it('returns the defined field for a known key', () => {
    expect(resolveField({ fields: [status], unknownFields: {} }, 'status')).toBe(status);
  });

  it('returns null for an unknown key when unknownFields is not provided', () => {
    expect(resolveField({ fields: [status], unknownFields: undefined }, 'custom')).toBeNull();
  });

  it('synthesizes a string field for an unknown key when unknownFields is provided', () => {
    const field = resolveField({ fields: [status], unknownFields: {} }, 'custom');

    expect(field).toMatchObject({ key: 'custom', label: 'custom', type: 'string' });
    expect(field?.operators).toEqual(DEFAULT_OPERATORS);
  });

  it('takes operators from the template', () => {
    const field = resolveField(
      { fields: [], unknownFields: { operators: ['contains', 'not_contains'] } },
      'custom'
    );

    expect(field?.operators).toEqual(['contains', 'not_contains']);
  });

  it('carries the other template members onto the synthesized field', () => {
    const validate = (value: string) => value.length > 0;
    const validation = { 'unknown-operator': false } as const;
    const field = resolveField(
      {
        fields: [],
        unknownFields: { hideSingleOperator: true, allowSpaces: true, validate, validation },
      },
      'custom'
    );

    expect(field).toMatchObject({
      hideSingleOperator: true,
      allowSpaces: true,
      validate,
      validation,
    });
  });

  it('prefers a defined field over the template', () => {
    const field = resolveField(
      { fields: [status], unknownFields: { operators: ['contains'] } },
      'status'
    );

    expect(field?.operators).toEqual(['is', 'is_not']);
  });
});
