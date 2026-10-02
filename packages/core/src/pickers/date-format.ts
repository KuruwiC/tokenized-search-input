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
 * UTC mode is supported when no custom parse is provided.
 * Custom parse may not preserve timezone information.
 */
export function supportsUTCMode(config?: DateTimeFormatConfig): boolean {
  return !config?.parse;
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

/**
 * Check if two dates represent the same month.
 * Useful for calendar navigation to avoid unnecessary re-renders.
 */
export function isSameMonth(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
