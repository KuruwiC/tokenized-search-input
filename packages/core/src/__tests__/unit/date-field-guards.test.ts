import { describe, expect, expectTypeOf, it } from 'vitest';
import type { DateFieldDefinition, DateTimeFieldDefinition, FieldDefinition } from '../../types';
import { isDateField, isDateOrDateTimeField, isDateTimeField } from '../../utils';

const date: FieldDefinition = { key: 'd', label: 'D', type: 'date', operators: ['is'] };
const datetime: FieldDefinition = { key: 't', label: 'T', type: 'datetime', operators: ['is'] };
const text: FieldDefinition = { key: 's', label: 'S', type: 'string', operators: ['is'] };

describe('date field guards', () => {
  it('tell date and datetime fields from the others', () => {
    expect([date, datetime, text, undefined, null].map(isDateOrDateTimeField)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
    expect([date, datetime, text].map((field) => isDateField(field))).toEqual([true, false, false]);
    expect([date, datetime, text].map((field) => isDateTimeField(field))).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('narrow a field definition to the date definitions', () => {
    const field = [date, datetime, text][0] as FieldDefinition | undefined;
    if (isDateOrDateTimeField(field)) {
      expectTypeOf(field).toExtend<DateFieldDefinition | DateTimeFieldDefinition>();
    }
    if (isDateField(field)) expectTypeOf(field).toExtend<DateFieldDefinition>();
    if (isDateTimeField(field)) expectTypeOf(field).toExtend<DateTimeFieldDefinition>();
  });

  it('accept any value with a type, as before', () => {
    expect(isDateOrDateTimeField({ type: 'date' })).toBe(true);
    expect(isDateOrDateTimeField({ type: 'number' })).toBe(false);
  });
});
