import { isDevelopment } from '../utils/env';
import { fromInstant, pad, parseDateTimeValue, toInstant } from './date-time-value';

// The calendar cells of a picker are days; a day is `yyyy-MM-dd`, with no time zone.

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

/**
 * The day a bound stands for, or null when there is no bound or it is not a date. A
 * string is the date it is written with, except that in UTC mode a string with a time
 * is the day that moment falls on in UTC, as a `Date` is.
 */
export function resolveBoundDay(bound: Date | string | undefined, utc: boolean): string | null {
  if (bound === undefined) return null;
  if (typeof bound === 'string') {
    const parsed = parseDateTimeValue(bound, 'datetime');
    if (!parsed.ok) return null;
    if (utc && parsed.value.time !== undefined) {
      return fromInstant(toInstant(parsed.value), 'Z')?.date ?? parsed.value.date;
    }
    return parsed.value.date;
  }
  if (Number.isNaN(bound.getTime())) return null;
  if (!utc) return toCalendarDay(bound);
  return `${pad(bound.getUTCFullYear(), 4)}-${pad(bound.getUTCMonth() + 1)}-${pad(bound.getUTCDate())}`;
}

function resolveBoundDayOrWarn(
  name: 'minDate' | 'maxDate',
  bound: Date | string | undefined,
  utc: boolean
): string | null {
  const day = resolveBoundDay(bound, utc);
  if (day === null && bound !== undefined && isDevelopment()) {
    console.warn(
      `[TokenizedSearchInput] ${name} ${JSON.stringify(String(bound))} is not a date and is ignored. Use yyyy-MM-dd, yyyy-MM-ddTHH:mm[:ss][Z|±HH:MM] or a Date.`
    );
  }
  return day;
}

/**
 * Tells whether a calendar cell is out of range. Bounds and cells are compared as
 * days, so a bound with a time in it still leaves its own day selectable. In UTC mode
 * a bound with a moment in it is the day that moment falls on in UTC. A bound that is
 * not a date is ignored, with a warning in development.
 */
export function createDayMatcher(
  field: {
    minDate?: Date | string;
    maxDate?: Date | string;
    disabledDates?: (date: Date) => boolean;
  },
  utc: boolean
): (cell: Date) => boolean {
  const min = resolveBoundDayOrWarn('minDate', field.minDate, utc);
  const max = resolveBoundDayOrWarn('maxDate', field.maxDate, utc);
  return (cell) => {
    const day = toCalendarDay(cell);
    if (min !== null && day < min) return true;
    if (max !== null && day > max) return true;
    return field.disabledDates?.(cell) ?? false;
  };
}
