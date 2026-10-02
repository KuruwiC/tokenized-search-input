import { format, isValid, parse, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type {
  DateFieldDefinition,
  DateFormatConfig,
  DateTimeFieldDefinition,
  DateTimeFormatConfig,
} from '../types';
import {
  type DateTimeValue,
  formatDateTimeValue,
  localMidnight,
  localOffsetAt,
  parseDateTimeValue,
  toInstant,
} from './date-time-value';
import { err, ok, type ParseResult } from './navigation-parsers';

export const DEFAULT_DATE_VALUE_FORMAT = 'yyyy-MM-dd';
export const DEFAULT_DATETIME_VALUE_FORMAT = "yyyy-MM-dd'T'HH:mm:ssxxx";

/** What the date functions need to know about a date or datetime field. */
type DateLikeField = Pick<DateFieldDefinition | DateTimeFieldDefinition, 'type' | 'formatConfig'>;

/**
 * Parses ISO 8601 string to Date object.
 * Internal helper for converting stored values to Date for calendar/picker use.
 * Accepts both strict ISO (2024-03-05) and loose formats (2024-3-5).
 */
export function parseISOToDate(isoValue: string): Date | null {
  if (!isoValue) return null;

  // Try strict ISO first
  let parsed = parseISO(isoValue);
  if (isValid(parsed)) return parsed;

  // Fallback: try parsing with default format (handles 2024-3-5)
  parsed = parse(isoValue, DEFAULT_DATE_VALUE_FORMAT, new Date());
  if (isValid(parsed)) return parsed;

  return null;
}

/**
 * Formats Date to ISO 8601 string for date fields.
 */
function formatDateToISO(date: Date): string {
  if (!date || !isValid(date)) return '';
  return format(date, DEFAULT_DATE_VALUE_FORMAT);
}

/**
 * Formats Date to ISO 8601 datetime string with local timezone.
 */
function formatDateTimeToISO(date: Date): string {
  if (!date || !isValid(date)) return '';
  return format(date, DEFAULT_DATETIME_VALUE_FORMAT);
}

/**
 * Reads `input` as a value of `field`: with the field's custom parse when it has one,
 * otherwise as the one strict format. This is the only way a typed date enters the
 * library, so validation, storage and display all agree on what a date is.
 */
export function parseDateFieldValue(
  input: string,
  field: DateLikeField
): ParseResult<DateTimeValue> {
  const trimmed = input.trim();
  const message = field.type === 'date' ? 'Invalid date format' : 'Invalid datetime format';
  const parseConfig = field.formatConfig?.parse;
  if (!parseConfig) return parseDateTimeValue(trimmed, field.type);

  let parsed: DateTimeValue | null;
  try {
    parsed = parseConfig(trimmed);
  } catch {
    // A parse supplied by the application that throws rejects the input like one that returns null.
    parsed = null;
  }
  if (!parsed) return err(message);
  return ok(field.type === 'date' ? { date: parsed.date } : parsed);
}

/**
 * The string stored in a token for `value`. A datetime field that requires a time
 * stores a date that has none as local midnight.
 */
export function toStoredValue(
  value: DateTimeValue,
  field: Pick<DateFieldDefinition | DateTimeFieldDefinition, 'type'> & { timeRequired?: boolean }
): string {
  if (field.type === 'date') return value.date;
  const complete =
    value.time === undefined && field.timeRequired ? localMidnight(value.date) : value;
  return formatDateTimeValue(complete);
}

/**
 * The stored form of a value typed for `field`, or the trimmed input when it is not
 * a valid value, so the user can see and fix what they typed.
 */
export function normalizeDateFieldValue(
  input: string,
  field: DateLikeField & { timeRequired?: boolean }
): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  const parsed = parseDateFieldValue(trimmed, field);
  return parsed.ok ? toStoredValue(parsed.value, field) : trimmed;
}

/**
 * The text shown for a date. A custom `format` is given the typed value.
 */
export function getDateDisplayValue(value: DateTimeValue, config?: DateFormatConfig): string {
  if (config?.format) {
    try {
      return config.format(value);
    } catch {
      // A format supplied by the application that throws falls back to the plain date.
      return value.date;
    }
  }
  return value.date;
}

/**
 * Converts Date to internal ISO value for date fields.
 */
export function getDateInternalValue(date: Date | null): string {
  if (!date) return '';
  return formatDateToISO(date);
}

/**
 * UTC mode is supported when no custom parse is provided.
 * Custom parse may not preserve timezone information.
 */
export function supportsUTCMode(config?: DateTimeFormatConfig): boolean {
  return !config?.parse;
}

export function extractTimezone(value: string): string | null {
  if (!value) return null;

  const timezonePattern = /(Z|[+-]\d{2}:?\d{2})$/;
  const match = value.match(timezonePattern);

  if (!match) return null;

  const tz = match[1];
  if (tz === 'Z') return 'Z';
  if (tz.includes(':')) {
    return tz;
  }
  return `${tz.slice(0, 3)}:${tz.slice(3)}`;
}

/**
 * JavaScript Date objects don't preserve timezone information after parsing.
 * We must extract timezone from the original string to determine if it's UTC.
 */
export function isUTCValue(value: string): boolean {
  const tz = extractTimezone(value);
  if (!tz) return false;
  if (tz === 'Z') return true;
  return tz === '+00:00' || tz === '-00:00';
}

/**
 * Checks if a value contains a time component.
 * Uses the same logic as navigation-parsers.ts extractTime for consistency.
 * Matches: "2024-03-05T14:30", "2024-03-05 14:30", "2024-03-05T14", etc.
 * Also handles milliseconds: "2024-03-05T14:30:45.123Z"
 */
export function hasTimeComponent(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  // Full time: [T or space] followed by HH:MM (with optional :SS, milliseconds, and timezone)
  // Supports: T14:30, T14:30:45, T14:30:45.123, T14:30:45Z, T14:30:45.123Z, T14:30:45+09:00
  if (/[T\s]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(trimmed)) {
    return true;
  }
  // Partial time with colon: [T or space] followed by HH: or HH:M
  if (/[T\s]\d{1,2}:\d{0,1}$/.test(trimmed)) {
    return true;
  }
  // Hour only: [T or space] followed by HH
  if (/[T\s]\d{1,2}$/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Checks if a value is date-only format (yyyy-MM-dd without time component).
 * Returns true for strict date-only format and partial date inputs.
 * Returns false if the value contains time indicators.
 */
export function isDateOnlyValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  return !hasTimeComponent(trimmed);
}

const DEFAULT_DATETIME_DISPLAY_LENGTH = 'HH:mm'.length;

/**
 * The text shown for a datetime: the reading in the value's own offset, with the
 * offset named unless it is the local one. A custom `format` is given the typed value.
 */
export function getDateTimeDisplayValue(
  value: DateTimeValue,
  config?: DateTimeFormatConfig
): string {
  if (config?.format) {
    try {
      return config.format(value);
    } catch {
      // A format supplied by the application that throws falls back to the canonical string.
      return formatDateTimeValue(value);
    }
  }

  if (value.time === undefined) return value.date;
  const reading = `${value.date} ${value.time.slice(0, DEFAULT_DATETIME_DISPLAY_LENGTH)}`;
  if (value.offset === undefined) return reading;
  if (value.offset === 'Z') return `${reading} (UTC)`;
  if (value.offset === localOffsetAt(toInstant(value))) return reading;
  return `${reading} (${value.offset})`;
}

/**
 * Converts Date to internal ISO value for datetime fields.
 */
export function getDateTimeInternalValue(
  date: Date | null,
  _config?: DateTimeFormatConfig,
  isUTC?: boolean
): string {
  if (!date) return '';

  if (isUTC) {
    return formatInTimeZone(date, 'UTC', "yyyy-MM-dd'T'HH:mm:ssXXX");
  }

  return formatDateTimeToISO(date);
}

export function isDateField(fieldDef: { type: string } | undefined): boolean {
  return fieldDef?.type === 'date';
}

export function isDateTimeField(fieldDef: { type: string } | undefined): boolean {
  return fieldDef?.type === 'datetime';
}

export function isDateOrDateTimeField(fieldDef: { type: string } | undefined): boolean {
  return isDateField(fieldDef) || isDateTimeField(fieldDef);
}

/**
 * Validates date value using custom parse or the strict format.
 */
export function validateDateValue(value: string, config?: DateFormatConfig): boolean | string {
  if (!value?.trim()) return false;
  const result = parseDateFieldValue(value, { type: 'date', formatConfig: config });
  return result.ok ? true : result.error;
}

/**
 * Validates datetime value using custom parse or the strict format.
 */
export function validateDateTimeValue(
  value: string,
  config?: DateTimeFormatConfig
): boolean | string {
  if (!value?.trim()) return false;
  const result = parseDateFieldValue(value, { type: 'datetime', formatConfig: config });
  return result.ok ? true : result.error;
}

export function createDateValidator(
  config?: DateFormatConfig
): (value: string) => boolean | string {
  return (value: string) => validateDateValue(value, config);
}

export function createDateTimeValidator(
  config?: DateTimeFormatConfig
): (value: string) => boolean | string {
  return (value: string) => validateDateTimeValue(value, config);
}

/**
 * Check if two dates represent the same month.
 * Useful for calendar navigation to avoid unnecessary re-renders.
 */
export function isSameMonth(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
