/**
 * Unit tests for parsing date and time input for navigation scenarios.
 */
import { describe, expect, it } from 'vitest';
import {
  parseDateForNavigation,
  parseDateTimeForNavigation,
} from '../../pickers/navigation-parsers';

describe('parseDateTimeForNavigation', () => {
  describe('partial time parsing', () => {
    it('parses date with T only (no time digits)', () => {
      const result = parseDateTimeForNavigation('2025-11-22T');
      expect(result.date).not.toBeNull();
      expect(result.date?.getFullYear()).toBe(2025);
      expect(result.date?.getMonth()).toBe(10); // November is 10
      expect(result.date?.getDate()).toBe(22);
      expect(result.time).toBeNull();
    });

    it('parses date with hour only (T11)', () => {
      const result = parseDateTimeForNavigation('2025-11-22T11');
      expect(result.date).not.toBeNull();
      expect(result.date?.getFullYear()).toBe(2025);
      expect(result.time).toEqual({ hours: 11, minutes: 0 });
    });

    it('parses date with space and hour only', () => {
      const result = parseDateTimeForNavigation('2025-11-22 11');
      expect(result.date).not.toBeNull();
      expect(result.date?.getFullYear()).toBe(2025);
      expect(result.time).toEqual({ hours: 11, minutes: 0 });
    });

    it('parses date with hour and colon (T11:)', () => {
      const result = parseDateTimeForNavigation('2025-11-22T11:');
      expect(result.date).not.toBeNull();
      expect(result.time).toEqual({ hours: 11, minutes: 0 });
    });

    it('parses date with hour and partial minute (T11:3)', () => {
      const result = parseDateTimeForNavigation('2025-11-22T11:3');
      expect(result.date).not.toBeNull();
      expect(result.time).toEqual({ hours: 11, minutes: 30 });
    });

    it('parses date with full time (T11:30)', () => {
      const result = parseDateTimeForNavigation('2025-11-22T11:30');
      expect(result.date).not.toBeNull();
      expect(result.time).toEqual({ hours: 11, minutes: 30 });
    });

    it('parses date with full time and seconds (T11:30:45)', () => {
      const result = parseDateTimeForNavigation('2025-11-22T11:30:45');
      expect(result.date).not.toBeNull();
      expect(result.time).toEqual({ hours: 11, minutes: 30 });
    });

    it('parses date with full time and timezone (T11:30:45Z)', () => {
      const result = parseDateTimeForNavigation('2025-11-22T11:30:45Z');
      expect(result.date).not.toBeNull();
      expect(result.time).toEqual({ hours: 11, minutes: 30 });
    });
  });

  describe('time-only parsing', () => {
    it('parses time-only input (11:30)', () => {
      const result = parseDateTimeForNavigation('11:30');
      expect(result.date).toBeNull();
      expect(result.time).toEqual({ hours: 11, minutes: 30 });
    });

    it('parses hour-only input (11)', () => {
      const result = parseDateTimeForNavigation('11');
      // "11" is parsed as time-only (hour with 0 minutes)
      expect(result.date).toBeNull();
      expect(result.time).toEqual({ hours: 11, minutes: 0 });
    });
  });

  describe('date-only parsing', () => {
    it('parses date without time', () => {
      const result = parseDateTimeForNavigation('2025-11-22');
      expect(result.date).not.toBeNull();
      expect(result.date?.getFullYear()).toBe(2025);
      expect(result.time).toBeNull();
    });

    it('parses year-month only', () => {
      const result = parseDateTimeForNavigation('2025-11');
      expect(result.date).not.toBeNull();
      expect(result.date?.getFullYear()).toBe(2025);
      expect(result.date?.getMonth()).toBe(10);
      expect(result.time).toBeNull();
    });
  });
});

/** The local calendar day of `date` as [year, month (1-12), day], or null. */
const dayOf = (date: Date | null) =>
  date ? [date.getFullYear(), date.getMonth() + 1, date.getDate()] : null;

describe('parseDateForNavigation', () => {
  describe('slash dates', () => {
    it('reads a first number above 12 as the day (DD/MM/YYYY)', () => {
      expect(dayOf(parseDateForNavigation('13/05/2024'))).toEqual([2024, 5, 13]);
    });

    it('reads a second number above 12 as the day (MM/DD/YYYY)', () => {
      expect(dayOf(parseDateForNavigation('05/13/2024'))).toEqual([2024, 5, 13]);
    });

    it('reads an ambiguous date, both numbers 12 or below, as MM/DD/YYYY', () => {
      expect(dayOf(parseDateForNavigation('05/03/2024'))).toEqual([2024, 5, 3]);
      expect(dayOf(parseDateForNavigation('12/05/2024'))).toEqual([2024, 12, 5]);
    });

    it('rejects a slash date with no month in either place', () => {
      expect(parseDateForNavigation('13/13/2024')).toBeNull();
    });
  });

  it('rejects a year-month whose month is out of range', () => {
    expect(parseDateForNavigation('2024-13')).toBeNull();
    expect(parseDateForNavigation('2024-00')).toBeNull();
    expect(dayOf(parseDateForNavigation('2024-12'))).toEqual([2024, 12, 1]);
  });
});

describe('parseDateTimeForNavigation with an out-of-range time', () => {
  it('reads no time from a time-only input whose hour or minute is out of range', () => {
    expect(parseDateTimeForNavigation('24:00')).toEqual({ date: null, time: null });
    expect(parseDateTimeForNavigation('11:60')).toEqual({ date: null, time: null });
    expect(parseDateTimeForNavigation('24')).toEqual({ date: null, time: null });
    expect(parseDateTimeForNavigation('23:59')).toEqual({
      date: null,
      time: { hours: 23, minutes: 59 },
    });
  });

  it('keeps the date and reads no time when the time after it is out of range', () => {
    for (const input of ['2024-03-05T24:00', '2024-03-05T11:60', '2024-03-05 24']) {
      const result = parseDateTimeForNavigation(input);
      expect(dayOf(result.date)).toEqual([2024, 3, 5]);
      expect(result.time).toBeNull();
    }
    expect(parseDateTimeForNavigation('2024-03-05T23:59').time).toEqual({
      hours: 23,
      minutes: 59,
    });
  });
});
