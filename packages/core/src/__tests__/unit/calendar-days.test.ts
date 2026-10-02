import { describe, expect, it } from 'vitest';
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
    expect(resolveBoundDay('2024-03-05T15:00', false)).toBe('2024-03-05');
    expect(resolveBoundDay('2024-03-05T01:00:00+09:00', true)).toBe('2024-03-05');
    expect(resolveBoundDay('2024-03-05T23:30:00Z', false)).toBe('2024-03-05');
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
  const cell = (month: number, day: number) => new Date(2024, month - 1, day);

  it('leaves the day of the maximum selectable even when its time is later in the day (f)', () => {
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
});
