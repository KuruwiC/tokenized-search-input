import type { Locale } from 'date-fns';
import { format, isValid, parse, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { DateFormatConfig, DateLocale, DateTimeFormatConfig } from '../types';

export const DEFAULT_DATE_VALUE_FORMAT = 'yyyy-MM-dd';
export const DEFAULT_DATE_DISPLAY_FORMAT = 'yyyy-MM-dd';
export const DEFAULT_DATETIME_VALUE_FORMAT = "yyyy-MM-dd'T'HH:mm:ssxxx";
export const DEFAULT_DATETIME_DISPLAY_FORMAT = 'yyyy-MM-dd HH:mm';
export const DEFAULT_TIME_DISPLAY_FORMAT = 'HH:mm';

export interface DateSerde {
  parse: (value: string) => Date | null;
  format: (date: Date) => string;
}

export function resolveDateSerde(
  config: DateFormatConfig | undefined,
  defaultValueFormat: string
): DateSerde {
  const valueFormat = config?.valueFormat ?? defaultValueFormat;

  return {
    parse: config?.parse ?? ((value: string) => parseDate(value, valueFormat)),
    format: config?.format ?? ((date: Date) => formatDate(date, valueFormat, config?.locale)),
  };
}

export function parseDate(
  value: string,
  valueFormat: string = DEFAULT_DATE_VALUE_FORMAT,
  referenceDate: Date = new Date()
): Date | null {
  if (!value) return null;

  const parsed = parse(value, valueFormat, referenceDate);
  if (isValid(parsed)) {
    return parsed;
  }

  const isoParsed = parseISO(value);
  if (isValid(isoParsed)) {
    return isoParsed;
  }

  return null;
}

export function formatDate(
  date: Date | null,
  formatStr: string = DEFAULT_DATE_VALUE_FORMAT,
  locale?: DateLocale
): string {
  if (!date || !isValid(date)) return '';
  return format(date, formatStr, locale ? { locale: locale as Locale } : undefined);
}

/**
 * Converts date value to display format only if it's a complete, valid date.
 * Partial or incomplete values are returned as-is to preserve user input during editing.
 */
export function getDateDisplayValue(value: string, config?: DateFormatConfig): string {
  const displayFormat = config?.displayFormat ?? DEFAULT_DATE_DISPLAY_FORMAT;
  const valueFormat = config?.valueFormat ?? DEFAULT_DATE_VALUE_FORMAT;

  if (config?.parse) {
    const date = config.parse(value);
    if (!date) return value;
    return formatDate(date, displayFormat, config?.locale);
  }

  const parsed = parse(value, valueFormat, new Date());
  if (!isValid(parsed)) return value;

  const formatted = format(parsed, valueFormat);
  if (formatted !== value) return value;

  return formatDate(parsed, displayFormat, config?.locale);
}

export function getDateInternalValue(date: Date | null, config?: DateFormatConfig): string {
  if (!date) return '';
  const serde = resolveDateSerde(config, DEFAULT_DATE_VALUE_FORMAT);
  return serde.format(date);
}

/**
 * UTC mode requires ISO 8601 format to preserve timezone information.
 * Custom formats may not include timezone offset, making UTC mode unreliable.
 */
export function supportsUTCMode(config?: DateTimeFormatConfig): boolean {
  return !config?.valueFormat || config.valueFormat === DEFAULT_DATETIME_VALUE_FORMAT;
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

export function getLocalTimezoneOffset(): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minutes = String(absOffset % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

export function isLocalTimezoneValue(value: string): boolean {
  const tz = extractTimezone(value);
  if (!tz) return true;
  if (tz === 'Z') return false;
  return tz === getLocalTimezoneOffset();
}

/**
 * Converts timezone offset string to IANA-compatible format for date-fns-tz.
 * '+09:00' → '+09:00', 'Z' → 'UTC'
 */
function timezoneOffsetToIANA(tz: string): string {
  if (tz === 'Z') return 'UTC';
  // date-fns-tz accepts offset strings like '+09:00' directly
  return tz;
}

/**
 * Non-local timezone values show original time from the string to avoid confusing conversions.
 * Converting "2024-01-01T10:00+09:00" to local time would change the displayed hour,
 * making it unclear what timezone the user is working in.
 *
 * Uses date-fns-tz for proper timezone-aware formatting with full locale support.
 */
function formatDateTimeWithTimezone(
  date: Date,
  value: string,
  displayFormat: string,
  locale?: DateLocale
): string {
  const tz = extractTimezone(value);

  if (isUTCValue(value)) {
    const formatted = formatInTimeZone(
      date,
      'UTC',
      displayFormat,
      locale ? { locale: locale as Locale } : undefined
    );
    return `${formatted} (UTC)`;
  }

  if (tz && !isLocalTimezoneValue(value)) {
    const tzIdent = timezoneOffsetToIANA(tz);
    const formatted = formatInTimeZone(
      date,
      tzIdent,
      displayFormat,
      locale ? { locale: locale as Locale } : undefined
    );
    return `${formatted} (${tz})`;
  }

  return formatDate(date, displayFormat, locale);
}

/**
 * Converts datetime value to display format with timezone suffix.
 * Partial or incomplete values are returned as-is to preserve user input during editing.
 */
export function getDateTimeDisplayValue(value: string, config?: DateTimeFormatConfig): string {
  if (!value) return value;

  const displayFormat = config?.displayFormat ?? DEFAULT_DATETIME_DISPLAY_FORMAT;
  const valueFormat = config?.valueFormat ?? DEFAULT_DATETIME_VALUE_FORMAT;

  if (config?.parse) {
    const date = config.parse(value);
    if (!date) return value;
    return formatDateTimeWithTimezone(date, value, displayFormat, config?.locale);
  }

  let parsed = parse(value, valueFormat, new Date());

  if (!isValid(parsed)) {
    parsed = parseISO(value);
  }

  if (!isValid(parsed)) return value;

  return formatDateTimeWithTimezone(parsed, value, displayFormat, config?.locale);
}

export function getDateTimeInternalValue(
  date: Date | null,
  config?: DateTimeFormatConfig,
  isUTC?: boolean
): string {
  if (!date) return '';

  if (isUTC) {
    // Use date-fns-tz for consistent UTC formatting
    // XXX token outputs 'Z' for UTC timezone
    return formatInTimeZone(date, 'UTC', "yyyy-MM-dd'T'HH:mm:ssXXX");
  }

  const serde = resolveDateSerde(config, DEFAULT_DATETIME_VALUE_FORMAT);
  return serde.format(date);
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

export function validateDateValue(value: string, config?: DateFormatConfig): boolean | string {
  if (!value || value.trim() === '') {
    return false;
  }

  const serde = resolveDateSerde(config, DEFAULT_DATE_VALUE_FORMAT);
  const date = serde.parse(value);
  if (!date) {
    return 'Invalid date format';
  }

  return true;
}

export function validateDateTimeValue(
  value: string,
  config?: DateTimeFormatConfig
): boolean | string {
  if (!value || value.trim() === '') {
    return false;
  }

  const serde = resolveDateSerde(config, DEFAULT_DATETIME_VALUE_FORMAT);
  const date = serde.parse(value);
  if (!date) {
    return 'Invalid datetime format';
  }

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
 * Normalizes user input like "2024-3-5" to "2024-03-05".
 */
export function normalizeDateValue(value: string, config?: DateFormatConfig): string {
  if (!value || value.trim() === '') return value;

  const serde = resolveDateSerde(config, DEFAULT_DATE_VALUE_FORMAT);
  const date = serde.parse(value);
  if (!date) return value;

  return serde.format(date);
}

/**
 * Preserves UTC mode when normalizing: "2024-1-1T10:0:0Z" → "2024-01-01T10:00:00Z".
 */
export function normalizeDateTimeValue(value: string, config?: DateTimeFormatConfig): string {
  if (!value || value.trim() === '') return value;

  const serde = resolveDateSerde(config, DEFAULT_DATETIME_VALUE_FORMAT);
  const date = serde.parse(value);
  if (!date) return value;

  if (isUTCValue(value)) {
    return getDateTimeInternalValue(date, config, true);
  }

  return serde.format(date);
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
