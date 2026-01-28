/**
 * Date and DateTime Navigation Parsers
 *
 * These parsers are used for keyboard navigation in date pickers.
 * They handle various date formats to allow flexible user input.
 */

import { chainParsers, err, isOk, ok, type ParseResult } from '../types/parse-result';
import type { TimeValue } from './time-picker';

// ============================================================================
// Date Navigation Parsers
// ============================================================================

type DateParseFn = (input: string) => ParseResult<Date>;

const parseYear: DateParseFn = (s) => {
  const m = s.match(/^(\d{4})$/);
  if (!m) return err('Not a year format', 'Expected: YYYY');
  return ok(new Date(Number(m[1]), 0, 1));
};

const parseYearMonth: DateParseFn = (s) => {
  const m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (!m) return err('Not a year-month format', 'Expected: YYYY-MM');
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return err('Invalid month', 'Month must be 1-12');
  return ok(new Date(Number(m[1]), month, 1));
};

const parseISODate: DateParseFn = (s) => {
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return err('Not an ISO date format', 'Expected: YYYY-MM-DD');
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return err('Invalid date');
  return ok(date);
};

const parseUSDate: DateParseFn = (s) => {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return err('Not a US date format', 'Expected: MM/DD/YYYY');
  const month = Number(m[1]) - 1;
  if (month < 0 || month > 11) return err('Invalid month');
  const date = new Date(Number(m[3]), month, Number(m[2]));
  if (Number.isNaN(date.getTime())) return err('Invalid date');
  return ok(date);
};

/**
 * Only accepts day > 12 to avoid ambiguity with US format (MM/DD/YYYY).
 * "13/05/2024" is unambiguous EU format, "05/13/2024" is unambiguous US format.
 */
const parseEUDate: DateParseFn = (s) => {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return err('Not an EU date format', 'Expected: DD/MM/YYYY');
  const first = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (first <= 12) return err('Ambiguous format');
  if (month < 0 || month > 11) return err('Invalid month');
  const date = new Date(Number(m[3]), month, first);
  if (Number.isNaN(date.getTime())) return err('Invalid date');
  return ok(date);
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
  return isOk(result) ? result.value : null;
}

// ============================================================================
// DateTime Navigation Parsers
// ============================================================================

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
