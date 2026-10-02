import { describe, expect, it } from 'vitest';
import {
  formatDateTimeValue,
  fromInstant,
  localOffsetAt,
  parseDateTimeValue,
  toInstant,
} from '../../pickers/date-time-value';

const parsed = (input: string, kind: 'date' | 'datetime' = 'datetime') => {
  const result = parseDateTimeValue(input, kind);
  if (!result.ok) throw new Error(`expected ${input} to parse: ${result.error}`);
  return result.value;
};

describe('parseDateTimeValue', () => {
  it('parses a date', () => {
    expect(parsed('2024-03-05', 'date')).toEqual({ date: '2024-03-05' });
    expect(parsed('2024-03-05')).toEqual({ date: '2024-03-05' });
  });

  it('parses a time with an optional second and millisecond', () => {
    expect(parsed('2024-03-05T14:30')).toEqual({ date: '2024-03-05', time: '14:30' });
    expect(parsed('2024-03-05T14:30:45')).toEqual({ date: '2024-03-05', time: '14:30:45' });
    expect(parsed('2024-03-05T14:30:45.123')).toEqual({
      date: '2024-03-05',
      time: '14:30:45.123',
    });
  });

  it('accepts a space between the date and the time', () => {
    expect(parsed('2024-03-05 14:30')).toEqual({ date: '2024-03-05', time: '14:30' });
  });

  it('keeps the time of a value that has an offset', () => {
    expect(parsed('2024-03-05T14:30:00+0900')).toEqual({
      date: '2024-03-05',
      time: '14:30:00',
      offset: '+09:00',
    });
    expect(parsed('2024-03-05T14:30:00+09:00').offset).toBe('+09:00');
    expect(parsed('2024-03-05T14:30:00-05:30').offset).toBe('-05:30');
  });

  it('parses a millisecond ISO string with Z', () => {
    expect(parsed('2024-03-05T14:30:45.123Z')).toEqual({
      date: '2024-03-05',
      time: '14:30:45.123',
      offset: 'Z',
    });
  });

  it('writes a zero offset as Z', () => {
    expect(parsed('2024-03-05T14:30:00+00:00').offset).toBe('Z');
    expect(parsed('2024-03-05T14:30:00-0000').offset).toBe('Z');
  });

  it('keeps midnight as a time', () => {
    expect(parsed('2024-03-05T00:00')).toEqual({ date: '2024-03-05', time: '00:00' });
  });

  it('trims surrounding whitespace', () => {
    expect(parsed('  2024-03-05  ', 'date')).toEqual({ date: '2024-03-05' });
  });

  it.each([
    '2024',
    '2024-03',
    '20240305',
    '2024-3-5',
    '2024-03-5',
    '2024/03/05',
    '03/05/2024',
  ])('rejects the partial or loose date %s', (input) => {
    expect(parseDateTimeValue(input, 'date').ok).toBe(false);
    expect(parseDateTimeValue(input, 'datetime').ok).toBe(false);
  });

  it.each([
    '2024-02-31',
    '2023-02-29',
    '2024-04-31',
    '2024-13-01',
    '2024-00-10',
    '2024-03-00',
  ])('rejects the date %s that does not exist', (input) => {
    expect(parseDateTimeValue(input, 'date').ok).toBe(false);
  });

  it('accepts a leap day', () => {
    expect(parsed('2024-02-29', 'date')).toEqual({ date: '2024-02-29' });
  });

  it.each([
    '2024-03-05T24:00',
    '2024-03-05T14:60',
    '2024-03-05T14:30:60',
    '2024-03-05T14',
    '2024-03-05T14:3',
    '2024-03-05T',
    '2024-03-05T14:30:45.12',
    '2024-03-05T14:30+25:00',
    '2024-03-05T14:30+09:60',
    '2024-03-05T14:30+09',
    '2024-03-05+09:00',
    'not-a-date',
    '',
  ])('rejects the datetime %s', (input) => {
    expect(parseDateTimeValue(input, 'datetime').ok).toBe(false);
  });

  it('rejects a time for a date field', () => {
    expect(parseDateTimeValue('2024-03-05T14:30', 'date').ok).toBe(false);
  });
});

describe('formatDateTimeValue', () => {
  it('writes a date alone', () => {
    expect(formatDateTimeValue({ date: '2024-03-05' })).toBe('2024-03-05');
  });

  it('writes the offset with a colon', () => {
    expect(formatDateTimeValue(parsed('2024-03-05T14:30:00+0900'))).toBe(
      '2024-03-05T14:30:00+09:00'
    );
    expect(formatDateTimeValue(parsed('2024-03-05 14:30:45.123Z'))).toBe(
      '2024-03-05T14:30:45.123Z'
    );
  });

  it('writes a value without an offset as it is', () => {
    expect(formatDateTimeValue({ date: '2024-03-05', time: '00:00' })).toBe('2024-03-05T00:00');
  });

  it('round-trips through parse', () => {
    for (const text of ['2024-03-05', '2024-03-05T14:30', '2024-03-05T14:30:45.123-03:30']) {
      expect(formatDateTimeValue(parsed(text))).toBe(text);
    }
  });
});

describe('toInstant and fromInstant', () => {
  it('reads a value with an offset as that moment', () => {
    expect(toInstant(parsed('2024-03-05T14:30:00+09:00')).toISOString()).toBe(
      '2024-03-05T05:30:00.000Z'
    );
    expect(toInstant(parsed('2024-03-05T14:30:45.123Z')).toISOString()).toBe(
      '2024-03-05T14:30:45.123Z'
    );
  });

  it('reads a value without an offset in the local time zone', () => {
    expect(toInstant(parsed('2024-03-05T14:30')).getTime()).toBe(
      new Date(2024, 2, 5, 14, 30).getTime()
    );
    expect(toInstant(parsed('2024-03-05', 'date')).getTime()).toBe(new Date(2024, 2, 5).getTime());
  });

  it('writes an instant in the given offset, whatever the local time zone is', () => {
    const instant = new Date('2024-03-05T05:30:00.000Z');
    expect(fromInstant(instant, '+09:00')).toEqual({
      date: '2024-03-05',
      time: '14:30:00',
      offset: '+09:00',
    });
    expect(fromInstant(instant, 'Z')).toEqual({
      date: '2024-03-05',
      time: '05:30:00',
      offset: 'Z',
    });
    expect(fromInstant(instant, '-08:00')).toEqual({
      date: '2024-03-04',
      time: '21:30:00',
      offset: '-08:00',
    });
  });

  it('keeps the millisecond of an instant', () => {
    expect(fromInstant(new Date('2024-03-05T14:30:45.123Z'), 'Z').time).toBe('14:30:45.123');
  });

  it('round-trips a value with an offset', () => {
    const value = parsed('2024-12-31T23:59:59.999+05:45');
    expect(fromInstant(toInstant(value), '+05:45')).toEqual(value);
  });
});

describe('localOffsetAt', () => {
  it('is the offset of the local time zone at that moment', () => {
    const at = new Date(2024, 6, 1, 12, 0);
    const minutes = -at.getTimezoneOffset();
    const result = localOffsetAt(at);
    if (minutes === 0) {
      expect(result).toBe('Z');
    } else {
      const sign = minutes < 0 ? '-' : '+';
      const abs = Math.abs(minutes);
      const hh = String(Math.floor(abs / 60)).padStart(2, '0');
      const mm = String(abs % 60).padStart(2, '0');
      expect(result).toBe(`${sign}${hh}:${mm}`);
    }
  });
});
