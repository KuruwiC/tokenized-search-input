import { err, ok, type ParseResult } from './navigation-parsers';

/** A UTC offset: `Z`, or `+HH:MM` / `-HH:MM`. */
export type DateTimeOffset = 'Z' | `${'+' | '-'}${string}`;

/**
 * A date or date-time, parsed once at the boundary. `time` is absent for a date;
 * `offset` is absent for a time that is read in the local time zone. Every field is
 * the wall-clock reading in the value's own offset.
 */
export type DateTimeValue = {
  /** `yyyy-MM-dd` */
  date: string;
  /** `HH:mm`, `HH:mm:ss` or `HH:mm:ss.S` to `HH:mm:ss.SSSSSSSSS`, as written */
  time?: string;
  offset?: DateTimeOffset;
};

const VALUE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?)(Z|[+-]\d{2}:?\d{2})?)?$/;
const OFFSET_PATTERN = /^([+-])(\d{2}):?(\d{2})$/;
const MS_PER_MINUTE = 60_000;

export function pad(n: number, length = 2): string {
  return String(n).padStart(length, '0');
}

function isRealDate(year: number, month: number, day: number): boolean {
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function isRealTime(time: string): boolean {
  const [hours = 0, minutes = 0, seconds = 0] = time.split(/[:.]/).map(Number);
  return hours <= 23 && minutes <= 59 && seconds <= 59;
}

function normalizeOffset(offset: string): DateTimeOffset | null {
  if (offset === 'Z') return 'Z';
  const match = OFFSET_PATTERN.exec(offset);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) return null;
  return offsetOfMinutes((match[1] === '-' ? -1 : 1) * (hours * 60 + minutes));
}

function offsetOfMinutes(minutes: number): DateTimeOffset {
  if (minutes === 0) return 'Z';
  const abs = Math.abs(minutes);
  return `${minutes < 0 ? '-' : '+'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function minutesOfOffset(offset: DateTimeOffset): number {
  if (offset === 'Z') return 0;
  const match = OFFSET_PATTERN.exec(offset);
  if (!match) return 0;
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * The only place a date or date-time string is read. Accepts
 * `yyyy-MM-dd` and `yyyy-MM-dd(T| )HH:mm[:ss[.S to .SSSSSSSSS]][Z|±HH:MM]`; a `date`
 * keeps only the date of the latter. Partial input (`2024`, `2024-03`, `20240305`) and
 * dates that do not exist (`2024-02-31`) are rejected.
 */
export function parseDateTimeValue(
  input: string,
  kind: 'date' | 'datetime'
): ParseResult<DateTimeValue> {
  const match = VALUE_PATTERN.exec(input.trim());
  const expected = 'yyyy-MM-dd or yyyy-MM-ddTHH:mm[:ss[.S]][Z|±HH:MM]';
  const message = kind === 'date' ? 'Invalid date format' : 'Invalid datetime format';
  if (!match) return err(message, `Expected: ${expected}`);

  const [, year, month, day, time, rawOffset] = match;
  if (!isRealDate(Number(year), Number(month), Number(day))) {
    return err(message, 'The date does not exist');
  }
  const date = `${year}-${month}-${day}`;
  if (time === undefined) return ok({ date });

  if (!isRealTime(time)) return err(message, 'The time is out of range');
  const offset = rawOffset === undefined ? undefined : normalizeOffset(rawOffset);
  if (offset === null) return err(message, 'The offset is out of range');
  if (kind === 'date') return ok({ date });
  return ok(offset === undefined ? { date, time } : { date, time, offset });
}

/** The canonical string: `T` between date and time, and the offset with a colon. */
export function formatDateTimeValue(value: DateTimeValue): string {
  if (value.time === undefined) return value.date;
  return `${value.date}T${value.time}${value.offset ?? ''}`;
}

function parts(value: DateTimeValue): [number, number, number, number, number, number, number] {
  const [year = 0, month = 1, day = 1] = value.date.split('-').map(Number);
  const [clock = '', fraction = ''] = (value.time ?? '').split('.');
  const [hours = 0, minutes = 0, seconds = 0] = clock.split(':').filter(Boolean).map(Number);
  const millis = Number(fraction.slice(0, 3).padEnd(3, '0'));
  return [year, month - 1, day, hours, minutes, seconds, millis];
}

/**
 * The moment a value stands for. A value without an offset is read in the local
 * time zone, and so is a date.
 */
export function toInstant(value: DateTimeValue): Date {
  const [year, month, day, hours, minutes, seconds, millis] = parts(value);
  const at = new Date(0);
  if (value.offset === undefined) {
    at.setFullYear(year, month, day);
    at.setHours(hours, minutes, seconds, millis);
    return at;
  }
  at.setUTCFullYear(year, month, day);
  at.setUTCHours(hours, minutes, seconds, millis);
  return new Date(at.getTime() - minutesOfOffset(value.offset) * MS_PER_MINUTE);
}

/**
 * The reading of `instant` on a clock that is `offset` away from UTC, or null when
 * `instant` is invalid or the reading falls outside the years 0000-9999 a date can be
 * written in.
 */
export function fromInstant(instant: Date, offset: DateTimeOffset): DateTimeValue | null {
  if (Number.isNaN(instant.getTime())) return null;
  const normalized = offsetOfMinutes(minutesOfOffset(offset));
  const wall = new Date(instant.getTime() + minutesOfOffset(normalized) * MS_PER_MINUTE);
  const year = wall.getUTCFullYear();
  if (Number.isNaN(year) || year < 0 || year > 9999) return null;
  const millis = wall.getUTCMilliseconds();
  return {
    date: `${pad(year, 4)}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`,
    time: `${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:${pad(wall.getUTCSeconds())}${
      millis === 0 ? '' : `.${pad(millis, 3)}`
    }`,
    offset: normalized,
  };
}

/** The offset the local time zone has at `at`, so a daylight-saving shift is honoured. */
export function localOffsetAt(at: Date): DateTimeOffset {
  return offsetOfMinutes(Math.round(-at.getTimezoneOffset()));
}

/**
 * The local clock reading `time` on `date`, written with the offset the zone has at that
 * moment. Where a clock change skips `time`, the reading is the moment the clock moves
 * to, so the date, time and offset always name one moment.
 */
export function atLocalTime(date: string, time: string): DateTimeValue {
  const instant = toInstant({ date, time });
  return fromInstant(instant, localOffsetAt(instant)) ?? { date, time };
}

export function localMidnight(date: string): DateTimeValue {
  return atLocalTime(date, '00:00:00');
}

/**
 * A value an application handed over, checked the way a string is: it has to survive
 * being written and read again, so a malformed date, time or offset is rejected and a
 * valid one comes back in canonical form.
 */
export function checkDateTimeValue(value: DateTimeValue): ParseResult<DateTimeValue> {
  return parseDateTimeValue(formatDateTimeValue(value), 'datetime');
}
