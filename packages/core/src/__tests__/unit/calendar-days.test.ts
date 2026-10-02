import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calendarDayToDate,
  createDayMatcher,
  resolveBoundDay,
  toCalendarDay,
} from '../../pickers/calendar-days';

describe('toCalendarDay and calendarDayToDate', () => {
  it('turn a cell into its local day and back', () => {
    const cell = new Date(2024, 2, 5, 17, 45);
    expect(toCalendarDay(cell)).toBe('2024-03-05');
    expect(toCalendarDay(calendarDayToDate('2024-03-05'))).toBe('2024-03-05');
    expect(calendarDayToDate('2024-03-05').getHours()).toBe(0);
  });
});

describe('resolveBoundDay', () => {
  it('is the date of a string, whatever time and offset follow it', () => {
    expect(resolveBoundDay('2024-03-05', false)).toBe('2024-03-05');
    expect(resolveBoundDay('2024-03-05', true)).toBe('2024-03-05');
    expect(resolveBoundDay('2024-03-05T15:00', false)).toBe('2024-03-05');
    expect(resolveBoundDay('2024-03-05T01:00:00+09:00', false)).toBe('2024-03-05');
    expect(resolveBoundDay('2024-03-05T23:30:00Z', false)).toBe('2024-03-05');
  });

  it('is the UTC day of a string with a time in UTC mode, as for a Date', () => {
    expect(resolveBoundDay('2024-03-05T01:00:00+09:00', true)).toBe('2024-03-04');
    expect(resolveBoundDay('2024-03-05T23:30:00-05:00', true)).toBe('2024-03-06');
    expect(resolveBoundDay('2024-03-05T23:30:00Z', true)).toBe('2024-03-05');
  });

  it('is the UTC day of the local moment for a string with a time and no offset in UTC mode', () => {
    const local = new Date(2024, 2, 5, 0, 30);
    expect(resolveBoundDay('2024-03-05T00:30', true)).toBe(local.toISOString().slice(0, 10));
  });

  it('is the local day of a Date', () => {
    expect(resolveBoundDay(new Date(2024, 2, 5, 15, 0), false)).toBe('2024-03-05');
    expect(resolveBoundDay(new Date(2024, 2, 5, 23, 59, 59), false)).toBe('2024-03-05');
  });

  it('is the UTC day of a Date in UTC mode', () => {
    expect(resolveBoundDay(new Date('2024-03-05T23:30:00Z'), true)).toBe('2024-03-05');
    expect(resolveBoundDay(new Date('2024-03-05T00:30:00Z'), true)).toBe('2024-03-05');
  });

  it('is nothing for no bound, an invalid Date or a string that is not a date', () => {
    expect(resolveBoundDay(undefined, false)).toBeNull();
    expect(resolveBoundDay(new Date(Number.NaN), false)).toBeNull();
    expect(resolveBoundDay('2024', false)).toBeNull();
    expect(resolveBoundDay('soon', false)).toBeNull();
  });
});

describe('createDayMatcher', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  const cell = (month: number, day: number) => new Date(2024, month - 1, day);

  it('leaves the day of the maximum selectable even when its time is later in the day', () => {
    const disabled = createDayMatcher({ maxDate: '2024-03-05T15:00' }, false);
    expect(disabled(cell(3, 5))).toBe(false);
    expect(disabled(cell(3, 4))).toBe(false);
    expect(disabled(cell(3, 6))).toBe(true);
  });

  it('leaves the day of the minimum selectable even when its time is later in the day', () => {
    const disabled = createDayMatcher({ minDate: '2024-03-05T15:00' }, false);
    expect(disabled(cell(3, 5))).toBe(false);
    expect(disabled(cell(3, 6))).toBe(false);
    expect(disabled(cell(3, 4))).toBe(true);
  });

  it('compares a Date bound by its local calendar day', () => {
    const disabled = createDayMatcher(
      { minDate: new Date(2024, 2, 5, 23, 0), maxDate: new Date(2024, 2, 7, 1, 0) },
      false
    );
    expect([4, 5, 6, 7, 8].map((day) => disabled(cell(3, day)))).toEqual([
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it('compares a Date bound by its UTC calendar day in UTC mode', () => {
    const disabled = createDayMatcher({ maxDate: new Date('2024-03-05T23:30:00Z') }, true);
    expect(disabled(cell(3, 5))).toBe(false);
    expect(disabled(cell(3, 6))).toBe(true);
  });

  it('asks disabledDates about the cell it is given', () => {
    const disabled = createDayMatcher({ disabledDates: (date) => date.getDay() === 0 }, false);
    expect(disabled(cell(3, 3))).toBe(true);
    expect(disabled(cell(3, 4))).toBe(false);
  });

  it('disables nothing without bounds', () => {
    expect(createDayMatcher({}, false)(cell(3, 5))).toBe(false);
  });

  describe('a bound that is not a date', () => {
    it.each(['2024-1-1', '2024', 'soon'])('warns in development about the string %s', (bound) => {
      const disabled = createDayMatcher({ minDate: bound }, false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('minDate');
      expect(String(warn.mock.calls[0]?.[0])).toContain(bound);
      expect(disabled(cell(1, 1))).toBe(false);
    });

    it('warns about an invalid Date', () => {
      createDayMatcher({ maxDate: new Date(Number.NaN) }, false);
      expect(String(warn.mock.calls[0]?.[0])).toContain('maxDate');
    });

    it('does not warn in production, or for a bound that is a date or is not given', () => {
      createDayMatcher({ minDate: '2024-03-05', maxDate: new Date() }, false);
      createDayMatcher({}, false);
      vi.stubEnv('NODE_ENV', 'production');
      createDayMatcher({ minDate: 'soon' }, false);
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
