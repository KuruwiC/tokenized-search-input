import { describe, expect, it } from 'vitest';
import { resolveTokenValue } from '../../serializer/resolve-token-value';
import type { FieldDefinition } from '../../types';

const status: FieldDefinition = {
  key: 'status',
  label: 'Status',
  type: 'enum',
  operators: ['is'],
  enumValues: [{ value: 'active', label: 'Active now' }, 'closed'],
};
const name: FieldDefinition = { key: 'name', label: 'Name', type: 'string', operators: ['is'] };

describe('resolveTokenValue', () => {
  it('reads the value of a quoted raw value', () => {
    expect(resolveTokenValue(name, '"john smith"')).toBe('john smith');
  });

  it('keeps a raw value that is not quoted as written', () => {
    expect(resolveTokenValue(name, 'john:smith')).toBe('john:smith');
  });

  it('resolves an enum value written as its label in another case', () => {
    expect(resolveTokenValue(status, 'ACTIVE NOW')).toBe('active');
    expect(resolveTokenValue(status, '"active now"')).toBe('active');
  });

  it('keeps an enum value that names no option as written', () => {
    expect(resolveTokenValue(status, 'other')).toBe('other');
  });

  it('keeps the value when there is no field', () => {
    expect(resolveTokenValue(null, '"a b"')).toBe('a b');
  });
});
