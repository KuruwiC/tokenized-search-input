/**
 * Unit tests for date and datetime value normalization.
 */
import { describe, expect, it } from 'vitest';
import { normalizeDateTimeValue, normalizeDateValue } from '../../pickers/date-format';

describe('normalizeDateValue', () => {
  it('normalizes valid ISO date with single-digit month/day', () => {
    expect(normalizeDateValue('2024-3-5')).toBe('2024-03-05');
  });

  it('normalizes valid ISO date with single-digit month', () => {
    expect(normalizeDateValue('2024-3-15')).toBe('2024-03-15');
  });

  it('normalizes valid ISO date with single-digit day', () => {
    expect(normalizeDateValue('2024-03-5')).toBe('2024-03-05');
  });

  it('returns already normalized date unchanged', () => {
    expect(normalizeDateValue('2024-03-05')).toBe('2024-03-05');
  });

  it('returns invalid date string unchanged', () => {
    expect(normalizeDateValue('not-a-date')).toBe('not-a-date');
  });

  it('normalizes partial date (year only) to full date', () => {
    // Year-only is parseable and gets normalized to Jan 1
    expect(normalizeDateValue('2024')).toBe('2024-01-01');
  });

  it('normalizes partial date (year-month) to full date', () => {
    // Year-month is parseable and gets normalized to day 1
    expect(normalizeDateValue('2024-03')).toBe('2024-03-01');
  });

  it('returns empty string unchanged', () => {
    expect(normalizeDateValue('')).toBe('');
  });

  it('uses custom parse config', () => {
    const config = {
      // Custom parse: accepts dd/MM/yyyy format and returns ISO
      parse: (input: string) => {
        const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) return null;
        const [, day, month, year] = match;
        return `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
      },
    };
    expect(normalizeDateValue('5/3/2024', config)).toBe('2024-03-05');
  });
});

describe('normalizeDateTimeValue', () => {
  it('normalizes valid ISO datetime', () => {
    // Input parsed as local time, output formatted with local timezone offset
    const result = normalizeDateTimeValue('2024-03-05T14:30:00');
    // The output should start with the correct date/time but have timezone
    expect(result).toMatch(/^2024-03-05T14:30:00[+-]\d{2}:\d{2}$/);
  });

  it('preserves UTC mode with Z suffix', () => {
    expect(normalizeDateTimeValue('2024-03-05T14:30:00Z')).toBe('2024-03-05T14:30:00Z');
  });

  it('preserves UTC mode with +00:00 suffix', () => {
    expect(normalizeDateTimeValue('2024-03-05T14:30:00+00:00')).toBe('2024-03-05T14:30:00Z');
  });

  it('normalizes datetime with non-local timezone to local timezone', () => {
    // Non-UTC timezone values are converted to local timezone during normalization
    // because JavaScript Date objects don't preserve original timezone
    const input = '2024-03-05T14:30:00+09:00';
    const result = normalizeDateTimeValue(input);
    // Output should be valid datetime with timezone offset
    expect(result).toMatch(/^2024-03-05T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it('returns invalid datetime string unchanged', () => {
    expect(normalizeDateTimeValue('not-a-datetime')).toBe('not-a-datetime');
  });

  it('preserves date-only format by default (allowDateOnly: true)', () => {
    const result = normalizeDateTimeValue('2024-03-05');
    expect(result).toBe('2024-03-05');
  });

  it('converts date-only to full datetime when allowDateOnly is false', () => {
    const result = normalizeDateTimeValue('2024-03-05', undefined, false);
    expect(result).toMatch(/^2024-03-05T00:00:00[+-]\d{2}:\d{2}$/);
  });

  it('returns empty string unchanged', () => {
    expect(normalizeDateTimeValue('')).toBe('');
  });

  describe('timeRequired field config', () => {
    it('preserves date-only when timeRequired is false', () => {
      expect(normalizeDateTimeValue('2024-03-05', undefined, true)).toBe('2024-03-05');
    });

    it('preserves date-only when timeRequired is undefined (default)', () => {
      expect(normalizeDateTimeValue('2024-03-05')).toBe('2024-03-05');
    });

    it('converts date-only to datetime when timeRequired is true', () => {
      const result = normalizeDateTimeValue('2024-03-05', undefined, false);
      expect(result).toMatch(/^2024-03-05T00:00:00[+-]\d{2}:\d{2}$/);
    });

    it('datetime values are unaffected by timeRequired flag', () => {
      const datetimeInput = '2024-03-05T14:30:00+09:00';
      const withTimeOptional = normalizeDateTimeValue(datetimeInput, undefined, true);
      const withTimeRequired = normalizeDateTimeValue(datetimeInput, undefined, false);
      expect(withTimeOptional).toBe(withTimeRequired);
    });
  });
});
