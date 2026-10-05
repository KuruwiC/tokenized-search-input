import type {
  DateFieldDefinition,
  DateFormatConfig,
  DateTimeFieldDefinition,
  DateTimeFormatConfig,
} from '../types';
import {
  checkDateTimeValue,
  type DateTimeValue,
  formatDateTimeValue,
  localMidnight,
  localOffsetAt,
  parseDateTimeValue,
  toInstant,
} from './date-time-value';
import { ok, type ParseResult } from './navigation-parsers';

export const DEFAULT_DATE_VALUE_FORMAT = 'yyyy-MM-dd';

type DateLikeField = Pick<DateFieldDefinition | DateTimeFieldDefinition, 'type' | 'formatConfig'>;

/**
 * Reads `input` as a value of `field`. A stored value is in canonical form, which the
 * one strict format reads; only text that is not in that form, such as what the user
 * is typing, goes to the field's custom parse. What a custom parse returns has to
 * survive being written and read again, or the text is rejected. This is the only way
 * a date enters the library, so validation, storage and display agree on what a date is.
 */
export function parseDateFieldValue(
  input: string,
  field: DateLikeField
): ParseResult<DateTimeValue> {
  const trimmed = input.trim();
  const strict = parseDateTimeValue(trimmed, field.type);
  const parseConfig = field.formatConfig?.parse;
  if (strict.ok || !parseConfig) return strict;

  let custom: DateTimeValue | null;
  try {
    custom = parseConfig(trimmed);
  } catch {
    // A parse supplied by the application that throws rejects the input like one that returns null.
    custom = null;
  }
  if (!custom) return strict;
  const checked = checkDateTimeValue(custom);
  if (!checked.ok) return strict;
  return ok(field.type === 'date' ? { date: checked.value.date } : checked.value);
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

/** `true` when the value is a date, otherwise the parse error; `false` for empty input. */
export function validateDateValue(value: string, config?: DateFormatConfig): boolean | string {
  if (!value?.trim()) return false;
  const result = parseDateFieldValue(value, { type: 'date', formatConfig: config });
  return result.ok ? true : result.error;
}

/** `true` when the value is a datetime, otherwise the parse error; `false` for empty input. */
export function validateDateTimeValue(
  value: string,
  config?: DateTimeFormatConfig
): boolean | string {
  if (!value?.trim()) return false;
  const result = parseDateFieldValue(value, { type: 'datetime', formatConfig: config });
  return result.ok ? true : result.error;
}

export function isSameMonth(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
