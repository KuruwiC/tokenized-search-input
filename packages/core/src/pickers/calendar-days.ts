import { parseDateTimeValue } from './date-time-value';

/** The calendar cells of a picker are days; a day is `yyyy-MM-dd`, with no time zone. */

function pad(n: number, length = 2): string {
  return String(n).padStart(length, '0');
}

/** The day a calendar cell shows, which is its local date. */
export function toCalendarDay(cell: Date): string {
  return `${pad(cell.getFullYear(), 4)}-${pad(cell.getMonth() + 1)}-${pad(cell.getDate())}`;
}

/** The calendar cell of a day: its local midnight. */
export function calendarDayToDate(day: string): Date {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const cell = new Date(0);
  cell.setFullYear(year, month - 1, date);
  cell.setHours(0, 0, 0, 0);
  return cell;
}

/** The day a bound stands for, or null when there is no bound or it is not a date. */
export function resolveBoundDay(bound: Date | string | undefined, utc: boolean): string | null {
  if (bound === undefined) return null;
  if (typeof bound === 'string') {
    const parsed = parseDateTimeValue(bound, 'datetime');
    return parsed.ok ? parsed.value.date : null;
  }
  if (Number.isNaN(bound.getTime())) return null;
  if (!utc) return toCalendarDay(bound);
  return `${pad(bound.getUTCFullYear(), 4)}-${pad(bound.getUTCMonth() + 1)}-${pad(bound.getUTCDate())}`;
}

/**
 * Tells whether a calendar cell is out of range. Bounds and cells are compared as
 * days, so a bound with a time in it still leaves its own day selectable. In UTC mode
 * a bound given as a `Date` is the day it falls on in UTC.
 */
export function createDayMatcher(
  field: {
    minDate?: Date | string;
    maxDate?: Date | string;
    disabledDates?: (date: Date) => boolean;
  },
  utc: boolean
): (cell: Date) => boolean {
  const min = resolveBoundDay(field.minDate, utc);
  const max = resolveBoundDay(field.maxDate, utc);
  return (cell) => {
    const day = toCalendarDay(cell);
    if (min !== null && day < min) return true;
    if (max !== null && day > max) return true;
    return field.disabledDates?.(cell) ?? false;
  };
}
