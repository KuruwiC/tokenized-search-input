/** Parsers used when typing dates into picker navigation controls. */

import { calendarDayToDate } from './calendar-days';
import { parseDateTimeValue } from './date-time-value';
import { err, ok, type ParseErr, type ParseResult } from './parse-result';
import type { TimeValue } from './time-picker';

/** Chains parsers, returning the first success, or the last failure when all fail. */
const chainParsers = <T>(
  parsers: readonly ((input: string) => ParseResult<T>)[]
): ((input: string) => ParseResult<T>) => {
  return (input) => {
    let lastErr: ParseErr = err('No parsers provided');
    for (const parse of parsers) {
      const result = parse(input);
      if (result.ok) return result;
      lastErr = result;
    }
    return lastErr;
  };
};

type DateParseFn = (input: string) => ParseResult<Date>;

/**
 * Local midnight of a date, read by a token's own value rule so the picker never points at
 * a date the token rejects: a nonexistent date is an error rather than rolling over, and a
 * year below 100 is that year.
 */
const parseCalendarDate = (year: string, month: string, day: string): ParseResult<Date> => {
  const parsed = parseDateTimeValue(
    `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
    'date'
  );
  return parsed.ok ? ok(calendarDayToDate(parsed.value.date)) : parsed;
};

const parseYear: DateParseFn = (s) => {
  const m = s.match(/^(\d{4})$/);
  if (!m) return err('Not a year format', 'Expected: YYYY');
  return parseCalendarDate(m[1], '1', '1');
};

const parseYearMonth: DateParseFn = (s) => {
  const m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (!m) return err('Not a year-month format', 'Expected: YYYY-MM');
  return parseCalendarDate(m[1], m[2], '1');
};

const parseISODate: DateParseFn = (s) => {
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return err('Not an ISO date format', 'Expected: YYYY-MM-DD');
  return parseCalendarDate(m[1], m[2], m[3]);
};

const parseUSDate: DateParseFn = (s) => {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return err('Not a US date format', 'Expected: MM/DD/YYYY');
  return parseCalendarDate(m[3], m[1], m[2]);
};

/**
 * Only accepts day > 12 to avoid ambiguity with US format (MM/DD/YYYY).
 * "13/05/2024" is unambiguous EU format, "05/13/2024" is unambiguous US format.
 */
const parseEUDate: DateParseFn = (s) => {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return err('Not an EU date format', 'Expected: DD/MM/YYYY');
  if (Number(m[1]) <= 12) return err('Ambiguous format');
  return parseCalendarDate(m[3], m[2], m[1]);
};

/**
 * EU parser placed before US parser to catch unambiguous EU dates first.
 * This prevents "13/05/2024" from being rejected by the US parser.
 */
const dateNavigationParser = chainParsers<Date>([
  parseYear,
  parseYearMonth,
  parseISODate,
  parseEUDate,
  parseUSDate,
]);

export function parseDateForNavigation(input: string): Date | null {
  if (!input || typeof input !== 'string') return null;
  const result = dateNavigationParser(input.trim());
  return result.ok ? result.value : null;
}

export interface DateTimeNavigationResult {
  date: Date | null;
  time: TimeValue | null;
}

const parseTimeOnly = (s: string): TimeValue | null => {
  const fullMatch = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (fullMatch) {
    const hours = Number(fullMatch[1]);
    const minutes = Number(fullMatch[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
  }
  const partialWithColon = s.match(/^(\d{1,2}):(\d{0,1})$/);
  if (partialWithColon) {
    const hours = Number(partialWithColon[1]);
    const partialMinutes = partialWithColon[2];
    if (hours < 0 || hours > 23) return null;
    const minutes = partialMinutes ? Number(partialMinutes) * 10 : 0;
    return { hours, minutes };
  }
  const hourOnly = s.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const hours = Number(hourOnly[1]);
    if (hours < 0 || hours > 23) return null;
    return { hours, minutes: 0 };
  }
  return null;
};

const extractTime = (s: string): TimeValue | null => {
  const fullMatch = s.match(/[T\s](\d{1,2}):(\d{2})(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/);
  if (fullMatch) {
    const hours = Number(fullMatch[1]);
    const minutes = Number(fullMatch[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
  }
  const partialWithColon = s.match(/[T\s](\d{1,2}):(\d{0,1})$/);
  if (partialWithColon) {
    const hours = Number(partialWithColon[1]);
    const partialMinutes = partialWithColon[2];
    if (hours < 0 || hours > 23) return null;
    const minutes = partialMinutes ? Number(partialMinutes) * 10 : 0;
    return { hours, minutes };
  }
  const hourOnly = s.match(/[T\s](\d{1,2})$/);
  if (hourOnly) {
    const hours = Number(hourOnly[1]);
    if (hours < 0 || hours > 23) return null;
    return { hours, minutes: 0 };
  }
  return null;
};

const removeDateTimeSuffix = (s: string): string => {
  const withTime = s.replace(/[T\s]\d{0,2}(?::\d{0,2})?(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/, '');
  if (withTime !== s) return withTime;
  return s.replace(/[T\s]$/, '');
};

export function parseDateTimeForNavigation(input: string): DateTimeNavigationResult {
  const result: DateTimeNavigationResult = { date: null, time: null };

  if (!input || typeof input !== 'string') return result;

  try {
    const trimmed = input.trim();

    const timeOnly = parseTimeOnly(trimmed);
    if (timeOnly) {
      result.time = timeOnly;
      return result;
    }

    result.time = extractTime(trimmed);

    const datePartOnly = removeDateTimeSuffix(trimmed);
    result.date = parseDateForNavigation(datePartOnly);

    return result;
  } catch {
    return { date: null, time: null };
  }
}
