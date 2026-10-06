import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  atLocalTime,
  checkDateTimeValue,
  type DateTimeValue,
  formatDateTimeValue,
  fromInstant,
  localMidnight,
  localOffsetAt,
  parseDateTimeValue,
  toInstant,
} from '../../pickers/date-time-value';

const parsed = (input: string, kind: 'date' | 'datetime' = 'datetime') => {
  const result = parseDateTimeValue(input, kind);
  if (!result.ok) throw new Error(`expected ${input} to parse: ${result.error}`);
  return result.value;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

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
    '2024-03-05T14:30+25:00',
    '2024-03-05T14:30+09:60',
    '2024-03-05T14:30+09',
    '2024-03-05+09:00',
    'not-a-date',
    '',
  ])('rejects the datetime %s', (input) => {
    expect(parseDateTimeValue(input, 'datetime').ok).toBe(false);
  });

  it('keeps the date of a datetime given to a date field', () => {
    expect(parsed('2024-03-05T14:30', 'date')).toEqual({ date: '2024-03-05' });
    expect(parsed('2024-03-05 14:30:00+09:00', 'date')).toEqual({ date: '2024-03-05' });
  });

  it('still rejects a datetime that is not one for a date field', () => {
    expect(parseDateTimeValue('2024-03-05T25:00', 'date').ok).toBe(false);
    expect(parseDateTimeValue('2024-02-31T10:00', 'date').ok).toBe(false);
  });

  it.each([
    '.1',
    '.12',
    '.123',
    '.123456',
    '.123456789',
  ])('keeps the fractional second %s as written', (fraction) => {
    const text = `2024-03-05T14:30:45${fraction}Z`;
    expect(parsed(text).time).toBe(`14:30:45${fraction}`);
    expect(formatDateTimeValue(parsed(text))).toBe(text);
  });

  it.each(['.', '.1234567890', '.12a'])('rejects the fractional second %s', (fraction) => {
    expect(parseDateTimeValue(`2024-03-05T14:30:45${fraction}Z`, 'datetime').ok).toBe(false);
  });

  it('reads the millisecond of a longer fraction by truncation', () => {
    expect(toInstant(parsed('2024-03-05T14:30:45.123987Z')).toISOString()).toBe(
      '2024-03-05T14:30:45.123Z'
    );
    expect(toInstant(parsed('2024-03-05T14:30:45.5Z')).toISOString()).toBe(
      '2024-03-05T14:30:45.500Z'
    );
  });
});

describe('checkDateTimeValue', () => {
  // Values from an application are not checked by the compiler, so the table may hold bad ones
  const check = (value: object) => checkDateTimeValue(value as DateTimeValue);

  it('accepts a value in canonical form as it is', () => {
    expect(check({ date: '2024-03-05', time: '14:30:00', offset: '+09:00' })).toEqual({
      ok: true,
      value: { date: '2024-03-05', time: '14:30:00', offset: '+09:00' },
    });
    expect(check({ date: '2024-03-05' })).toEqual({ ok: true, value: { date: '2024-03-05' } });
  });

  it('writes an offset of zero as Z', () => {
    const result = check({ date: '2024-03-05', time: '14:30', offset: '+00:00' });
    expect(result.ok && result.value.offset).toBe('Z');
  });

  it.each([
    { date: '2024-3-5' },
    { date: '2024-02-31' },
    { date: '2024' },
    { date: '2024-03-05', time: '25:00' },
    { date: '2024-03-05', time: '14' },
    { date: '2024-03-05', time: '14:30', offset: '+5' },
    { date: '2024-03-05', time: '14:30', offset: '+99:00' },
    { date: '12024-03-05' },
  ])('rejects %j', (value) => {
    expect(check(value).ok).toBe(false);
  });
});

describe('fromInstant outside the years a date can be written in', () => {
  it('is null for an invalid Date', () => {
    expect(fromInstant(new Date(Number.NaN), 'Z')).toBeNull();
  });

  it('is null when the reading is not in 0000-9999', () => {
    expect(fromInstant(new Date('+010000-01-01T00:00:00Z'), 'Z')).toBeNull();
    expect(fromInstant(new Date('9999-12-31T23:00:00Z'), '+09:00')).toBeNull();
    expect(fromInstant(new Date('-000001-12-31T23:59:59Z'), 'Z')).toBeNull();
  });

  it('keeps the first and the last moment of the range', () => {
    expect(fromInstant(new Date('9999-12-31T23:59:59Z'), 'Z')?.date).toBe('9999-12-31');
    expect(fromInstant(new Date('0000-01-01T00:00:00Z'), 'Z')?.date).toBe('0000-01-01');
  });
});

// The suite runs in America/New_York (vitest.config.ts): in 2024 the clock moves from
// 02:00 EST (-05:00) to 03:00 EDT (-04:00) on March 10, and from 02:00 EDT back to 01:00 EST
// on November 3.
describe('local times across a clock change', () => {
  it.each([
    ['2024-03-09', '-05:00'],
    ['2024-03-10', '-05:00'],
    ['2024-03-11', '-04:00'],
    ['2024-11-03', '-04:00'],
    ['2024-11-04', '-05:00'],
  ])('writes local midnight of %s with the offset %s', (date, offset) => {
    expect(localMidnight(date)).toEqual({ date, time: '00:00:00', offset });
  });

  it('writes a time the clock skips as the moment the clock moves to', () => {
    const value = atLocalTime('2024-03-10', '02:30:00');
    expect(value).toEqual({ date: '2024-03-10', time: '03:30:00', offset: '-04:00' });
    expect(toInstant(value).toISOString()).toBe('2024-03-10T07:30:00.000Z');
  });

  it('writes a time the clock reads twice as the first of the two moments', () => {
    const value = atLocalTime('2024-11-03', '01:30:00');
    expect(value).toEqual({ date: '2024-11-03', time: '01:30:00', offset: '-04:00' });
    expect(toInstant(value).toISOString()).toBe('2024-11-03T05:30:00.000Z');
  });

  it('writes local midnight of a day whose midnight the clock skips as the moment the clock moves to', () => {
    // In America/Santiago the clock moves from 00:00 (-04:00) to 01:00 (-03:00) on 2024-09-08.
    vi.stubEnv('TZ', 'America/Santiago');
    expect(new Date(2024, 8, 8).getHours()).toBe(1);
    expect(localMidnight('2024-09-08')).toEqual({
      date: '2024-09-08',
      time: '01:00:00',
      offset: '-03:00',
    });
  });

  it('keeps the wall time where there is no gap', () => {
    expect(atLocalTime('2024-07-01', '09:15:00')).toEqual({
      date: '2024-07-01',
      time: '09:15:00',
      offset: '-04:00',
    });
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
    expect(toInstant(parsed('2024-03-05T14:30')).toISOString()).toBe('2024-03-05T19:30:00.000Z');
    expect(toInstant(parsed('2024-07-05T14:30')).toISOString()).toBe('2024-07-05T18:30:00.000Z');
    expect(toInstant(parsed('2024-03-05', 'date')).toISOString()).toBe('2024-03-05T05:00:00.000Z');
  });

  it('reads a local time the clock skips with the offset before the change', () => {
    expect(toInstant(parsed('2024-03-10T02:30')).toISOString()).toBe('2024-03-10T07:30:00.000Z');
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
    expect(fromInstant(new Date('2024-03-05T14:30:45.123Z'), 'Z')?.time).toBe('14:30:45.123');
  });

  it('round-trips a value with an offset', () => {
    const value = parsed('2024-12-31T23:59:59.999+05:45');
    expect(fromInstant(toInstant(value), '+05:45')).toEqual(value);
  });
});

describe('localOffsetAt', () => {
  it('is the offset of the local time zone at that moment', () => {
    expect(localOffsetAt(new Date(2024, 0, 1, 12, 0))).toBe('-05:00');
    expect(localOffsetAt(new Date(2024, 6, 1, 12, 0))).toBe('-04:00');
  });

  it('changes at the moment the clock changes', () => {
    expect(localOffsetAt(new Date('2024-03-10T06:59:59.999Z'))).toBe('-05:00');
    expect(localOffsetAt(new Date('2024-03-10T07:00:00.000Z'))).toBe('-04:00');
  });

  it('is Z in a time zone that reads UTC', () => {
    vi.stubEnv('TZ', 'UTC');
    expect(localOffsetAt(new Date(2024, 6, 1, 12, 0))).toBe('Z');
  });

  it('keeps the minutes of an offset that is not a whole hour', () => {
    vi.stubEnv('TZ', 'Asia/Kathmandu');
    expect(localOffsetAt(new Date(2024, 6, 1, 12, 0))).toBe('+05:45');
  });
});
