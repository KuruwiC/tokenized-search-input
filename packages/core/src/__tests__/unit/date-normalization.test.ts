/**
 * Unit tests for the stored form of a typed date or datetime.
 */
import { describe, expect, it } from 'vitest';
import { normalizeDateFieldValue } from '../../pickers/date-format';
import type { DateTimeValue } from '../../pickers/date-time-value';
import type { DateFieldDefinition, DateTimeFieldDefinition } from '../../types';

const dateField = (formatConfig?: DateFieldDefinition['formatConfig']): DateFieldDefinition => ({
  key: 'due',
  label: 'Due',
  type: 'date',
  operators: ['is'],
  formatConfig,
});

const datetimeField = (extra: Partial<DateTimeFieldDefinition> = {}): DateTimeFieldDefinition => ({
  key: 'at',
  label: 'At',
  type: 'datetime',
  operators: ['is'],
  ...extra,
});

describe('normalizeDateFieldValue for a date field', () => {
  it('returns an already normalized date unchanged', () => {
    expect(normalizeDateFieldValue('2024-03-05', dateField())).toBe('2024-03-05');
  });

  it('leaves loose and partial dates as typed', () => {
    expect(normalizeDateFieldValue('2024-3-5', dateField())).toBe('2024-3-5');
    expect(normalizeDateFieldValue('2024', dateField())).toBe('2024');
    expect(normalizeDateFieldValue('2024-03', dateField())).toBe('2024-03');
  });

  it('leaves a date that does not exist as typed', () => {
    expect(normalizeDateFieldValue('2024-02-31', dateField())).toBe('2024-02-31');
  });

  it('returns an invalid string unchanged', () => {
    expect(normalizeDateFieldValue('not-a-date', dateField())).toBe('not-a-date');
  });

  it('returns an empty string unchanged', () => {
    expect(normalizeDateFieldValue('', dateField())).toBe('');
  });

  it('trims whitespace', () => {
    expect(normalizeDateFieldValue('  2024-03-05 ', dateField())).toBe('2024-03-05');
    expect(normalizeDateFieldValue('  nope ', dateField())).toBe('nope');
  });

  it('keeps the date of a datetime typed for a date field', () => {
    expect(normalizeDateFieldValue('2024-03-05T14:30:00+0900', dateField())).toBe('2024-03-05');
  });

  it('stores what a custom parse returns', () => {
    const field = dateField({
      parse: (input) => {
        const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) return null;
        const [, day, month, year] = match;
        return { date: `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}` };
      },
    });
    expect(normalizeDateFieldValue('5/3/2024', field)).toBe('2024-03-05');
    expect(normalizeDateFieldValue('nope', field)).toBe('nope');
  });

  it('drops the time a custom parse returns for a date field', () => {
    const value: DateTimeValue = { date: '2024-03-05', time: '14:30', offset: 'Z' };
    expect(normalizeDateFieldValue('x', dateField({ parse: () => value }))).toBe('2024-03-05');
  });

  describe('with a custom parse that reads day/month/year only', () => {
    const field = dateField({
      parse: (input) => {
        const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) return null;
        const [, day, month, year] = match;
        return { date: `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}` };
      },
    });

    it('keeps a value that is already in canonical form, which the parse rejects', () => {
      expect(normalizeDateFieldValue('2024-03-05', field)).toBe('2024-03-05');
    });
  });

  it('leaves the input as typed when a custom parse returns a value that cannot be written', () => {
    const malformed = [
      { date: '2024-3-5' },
      { date: '2024-02-31' },
      { date: '2024-03-05', time: '25:00' },
    ];
    for (const value of malformed) {
      expect(normalizeDateFieldValue('x', dateField({ parse: () => value }))).toBe('x');
    }
    const badOffset = datetimeField({
      formatConfig: { parse: () => ({ date: '2024-03-05', time: '10:00', offset: '+5' }) },
    });
    expect(normalizeDateFieldValue('x', badOffset)).toBe('x');
  });

  it('leaves the input as typed when a custom parse throws', () => {
    const field = dateField({
      parse: () => {
        throw new Error('boom');
      },
    });
    expect(normalizeDateFieldValue('2024-03-05', field)).toBe('2024-03-05');
  });
});

describe('normalizeDateFieldValue for a datetime field', () => {
  it('keeps the time of a value whose offset has no colon', () => {
    expect(normalizeDateFieldValue('2024-03-05T14:30:00+0900', datetimeField())).toBe(
      '2024-03-05T14:30:00+09:00'
    );
  });

  it('keeps an offset as it is', () => {
    expect(normalizeDateFieldValue('2024-03-05T14:30:00+09:00', datetimeField())).toBe(
      '2024-03-05T14:30:00+09:00'
    );
    expect(normalizeDateFieldValue('2024-03-05T14:30:00-05:30', datetimeField())).toBe(
      '2024-03-05T14:30:00-05:30'
    );
  });

  it('keeps UTC as Z', () => {
    expect(normalizeDateFieldValue('2024-03-05T14:30:00Z', datetimeField())).toBe(
      '2024-03-05T14:30:00Z'
    );
    expect(normalizeDateFieldValue('2024-03-05T14:30:00+00:00', datetimeField())).toBe(
      '2024-03-05T14:30:00Z'
    );
  });

  it('keeps milliseconds', () => {
    expect(normalizeDateFieldValue('2024-03-05T14:30:45.123Z', datetimeField())).toBe(
      '2024-03-05T14:30:45.123Z'
    );
  });

  it('writes a space between date and time as T', () => {
    expect(normalizeDateFieldValue('2024-03-05 14:30', datetimeField())).toBe('2024-03-05T14:30');
  });

  it('does not add the local offset to a time without one', () => {
    expect(normalizeDateFieldValue('2024-03-05T14:30:00', datetimeField())).toBe(
      '2024-03-05T14:30:00'
    );
  });

  it('returns an invalid datetime unchanged', () => {
    expect(normalizeDateFieldValue('not-a-datetime', datetimeField())).toBe('not-a-datetime');
    expect(normalizeDateFieldValue('2024-03-05T14', datetimeField())).toBe('2024-03-05T14');
  });

  it('returns an empty string unchanged', () => {
    expect(normalizeDateFieldValue('', datetimeField())).toBe('');
  });

  describe('timeRequired', () => {
    it('keeps a date alone when time is optional', () => {
      expect(normalizeDateFieldValue('2024-03-05', datetimeField())).toBe('2024-03-05');
      expect(normalizeDateFieldValue('2024-03-05', datetimeField({ timeRequired: false }))).toBe(
        '2024-03-05'
      );
    });

    it('adds local midnight to a date when time is required', () => {
      const result = normalizeDateFieldValue('2024-03-05', datetimeField({ timeRequired: true }));
      expect(result).toMatch(/^2024-03-05T00:00:00(Z|[+-]\d{2}:\d{2})$/);
    });

    it('does not change a value that has a time', () => {
      const input = '2024-03-05T14:30:00+09:00';
      expect(normalizeDateFieldValue(input, datetimeField({ timeRequired: true }))).toBe(
        normalizeDateFieldValue(input, datetimeField())
      );
    });
  });
});
