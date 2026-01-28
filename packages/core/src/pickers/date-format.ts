import { format, isValid, parse, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { DateFormatConfig, DateTimeFormatConfig } from '../types';

export const DEFAULT_DATE_VALUE_FORMAT = 'yyyy-MM-dd';
export const DEFAULT_DATETIME_VALUE_FORMAT = "yyyy-MM-dd'T'HH:mm:ssxxx";

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
 * Default parse: accepts ISO-like input and normalizes to yyyy-MM-dd.
 * Handles both strict ISO (2024-03-05) and loose formats (2024-3-5).
 */
function defaultDateParse(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try strict ISO first
  let parsed = parseISO(trimmed);
  if (isValid(parsed)) {
    return format(parsed, DEFAULT_DATE_VALUE_FORMAT);
  }

  // Fallback: try parsing with default format (handles 2024-3-5)
  parsed = parse(trimmed, DEFAULT_DATE_VALUE_FORMAT, new Date());
  if (isValid(parsed)) {
    return format(parsed, DEFAULT_DATE_VALUE_FORMAT);
  }

  return null;
}

/**
 * Default parse for datetime: validates and normalizes ISO datetime string.
 * Preserves original timezone offset from the input string.
 *
 * @param input - The datetime string to parse
 * @param allowDateOnly - If true, date-only values (yyyy-MM-dd) are preserved as-is.
 *                        If false, date-only values are converted to datetime format.
 */
function defaultDateTimeParse(input: string, allowDateOnly: boolean = true): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Preserve date-only format (yyyy-MM-dd) without adding time component
  if (allowDateOnly && isDateOnlyValue(trimmed)) {
    const parsed = parseISO(trimmed);
    if (!isValid(parsed)) return null;
    return format(parsed, DEFAULT_DATE_VALUE_FORMAT);
  }

  const parsed = parseISO(trimmed);
  if (!isValid(parsed)) return null;

  // Extract original timezone from input to preserve it
  const tz = extractTimezone(trimmed);

  if (tz === 'Z' || tz === '+00:00' || tz === '-00:00') {
    // UTC: format with Z suffix
    return formatInTimeZone(parsed, 'UTC', "yyyy-MM-dd'T'HH:mm:ssXXX");
  }

  if (tz) {
    // Non-local timezone: preserve the original offset by formatting in that timezone
    return formatInTimeZone(parsed, tz, "yyyy-MM-dd'T'HH:mm:ssxxx");
  }

  // No timezone or local: format with local timezone
  return format(parsed, DEFAULT_DATETIME_VALUE_FORMAT);
}

/**
 * Default format: returns ISO string as-is for date fields.
 */
function defaultDateFormat(isoValue: string): string {
  const date = parseISO(isoValue);
  if (!isValid(date)) return isoValue;
  return format(date, DEFAULT_DATE_VALUE_FORMAT);
}

/**
 * Converts date value to display format only if it's a complete, valid date.
 * Partial or incomplete values are returned as-is to preserve user input during editing.
 */
export function getDateDisplayValue(value: string, config?: DateFormatConfig): string {
  if (!value) return value;

  if (config?.format) {
    try {
      return config.format(value);
    } catch {
      // Custom format failed (e.g., invalid date), return raw value
      return value;
    }
  }

  const date = parseISO(value);
  if (!isValid(date)) return value;

  return defaultDateFormat(value);
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
 * Calculates timezone offset string for a specific date.
 * Uses the date's own offset to handle DST correctly.
 */
export function getTimezoneOffsetForDate(date: Date): string {
  const offset = date.getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minutes = String(absOffset % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

/**
 * Gets local timezone offset for current moment.
 * @deprecated Use getTimezoneOffsetForDate for DST-aware comparison
 */
export function getLocalTimezoneOffset(): string {
  return getTimezoneOffsetForDate(new Date());
}

/**
 * Checks if a datetime value's timezone matches the local timezone at that specific moment.
 * Handles DST correctly by comparing against the offset that would apply at the value's time.
 */
export function isLocalTimezoneValue(value: string): boolean {
  const tz = extractTimezone(value);
  if (!tz) return true;
  if (tz === 'Z') return false;

  // Parse the value to get the Date, then check what the local offset would be at that time
  const date = parseISO(value);
  if (!isValid(date)) return true;

  const localOffsetAtValueTime = getTimezoneOffsetForDate(date);
  return tz === localOffsetAtValueTime;
}

/**
 * Converts timezone offset string to IANA-compatible format for date-fns-tz.
 * '+09:00' → '+09:00', 'Z' → 'UTC'
 */
function timezoneOffsetToIANA(tz: string): string {
  if (tz === 'Z') return 'UTC';
  return tz;
}

/**
 * Default datetime display format string.
 */
const DEFAULT_DATETIME_DISPLAY = 'yyyy-MM-dd HH:mm';

/**
 * Non-local timezone values show original time from the string to avoid confusing conversions.
 * Converting "2024-01-01T10:00+09:00" to local time would change the displayed hour,
 * making it unclear what timezone the user is working in.
 */
function formatDateTimeWithTimezone(date: Date, value: string): string {
  const tz = extractTimezone(value);

  if (isUTCValue(value)) {
    const formatted = formatInTimeZone(date, 'UTC', DEFAULT_DATETIME_DISPLAY);
    return `${formatted} (UTC)`;
  }

  if (tz && !isLocalTimezoneValue(value)) {
    const tzIdent = timezoneOffsetToIANA(tz);
    const formatted = formatInTimeZone(date, tzIdent, DEFAULT_DATETIME_DISPLAY);
    return `${formatted} (${tz})`;
  }

  return format(date, DEFAULT_DATETIME_DISPLAY);
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

/**
 * Converts datetime value to display format with timezone suffix.
 * Partial or incomplete values are returned as-is to preserve user input during editing.
 * Date-only values (yyyy-MM-dd) are displayed without time component.
 */
export function getDateTimeDisplayValue(value: string, config?: DateTimeFormatConfig): string {
  if (!value) return value;

  if (config?.format) {
    try {
      return config.format(value);
    } catch {
      // Custom format failed (e.g., invalid date), return raw value
      return value;
    }
  }

  const date = parseISO(value);
  if (!isValid(date)) return value;

  // Date-only values should display without time
  if (isDateOnlyValue(value)) {
    return format(date, DEFAULT_DATE_VALUE_FORMAT);
  }

  return formatDateTimeWithTimezone(date, value);
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
 * Validates date value using custom parse or default ISO parsing.
 */
export function validateDateValue(value: string, config?: DateFormatConfig): boolean | string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }

  if (config?.parse) {
    try {
      const result = config.parse(trimmed);
      if (!result) return 'Invalid date format';
      return true;
    } catch {
      return 'Invalid date format';
    }
  }

  const result = defaultDateParse(trimmed);
  if (!result) return 'Invalid date format';
  return true;
}

/**
 * Validates datetime value using custom parse or default ISO parsing.
 */
export function validateDateTimeValue(
  value: string,
  config?: DateTimeFormatConfig
): boolean | string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }

  if (config?.parse) {
    try {
      const result = config.parse(trimmed);
      if (!result) return 'Invalid datetime format';
      return true;
    } catch {
      return 'Invalid datetime format';
    }
  }

  const result = defaultDateTimeParse(trimmed);
  if (!result) return 'Invalid datetime format';
  return true;
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
 * Normalizes user input to ISO format.
 * Uses custom parse if provided, otherwise default ISO parsing.
 * Trims whitespace before processing.
 */
export function normalizeDateValue(value: string, config?: DateFormatConfig): string {
  const trimmed = value?.trim();
  if (!trimmed) return trimmed ?? '';

  if (config?.parse) {
    try {
      const result = config.parse(trimmed);
      return result ?? trimmed;
    } catch {
      return trimmed;
    }
  }

  const result = defaultDateParse(trimmed);
  return result ?? trimmed;
}

/**
 * Normalizes datetime input to ISO format.
 * Preserves timezone offset from original input.
 * Trims whitespace before processing.
 *
 * @param value - The datetime string to normalize
 * @param config - Optional format configuration with custom parse function
 * @param allowDateOnly - If true, date-only values (yyyy-MM-dd) are preserved as-is.
 *                        If false, date-only values are converted to datetime format.
 *                        Default is true.
 */
export function normalizeDateTimeValue(
  value: string,
  config?: DateTimeFormatConfig,
  allowDateOnly: boolean = true
): string {
  const trimmed = value?.trim();
  if (!trimmed) return trimmed ?? '';

  if (config?.parse) {
    try {
      const result = config.parse(trimmed);
      return result ?? trimmed;
    } catch {
      return trimmed;
    }
  }

  const result = defaultDateTimeParse(trimmed, allowDateOnly);
  return result ?? trimmed;
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
