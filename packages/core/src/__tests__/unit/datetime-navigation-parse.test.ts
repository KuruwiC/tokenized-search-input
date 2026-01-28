/**
 * Unit tests for parsing date and time input for navigation scenarios.
 */
import { describe, expect, it } from 'vitest';
import { parseDateTimeForNavigation } from '../../pickers/navigation-parsers';

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
