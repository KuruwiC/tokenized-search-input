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
  /** `HH:mm`, `HH:mm:ss` or `HH:mm:ss.SSS` */
  time?: string;
  offset?: DateTimeOffset;
};

const VALUE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?)(Z|[+-]\d{2}:?\d{2})?)?$/;
const OFFSET_PATTERN = /^([+-])(\d{2}):?(\d{2})$/;
const MS_PER_MINUTE = 60_000;

function pad(n: number, length = 2): string {
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
 * `yyyy-MM-dd` and, for a `datetime`, `yyyy-MM-dd(T| )HH:mm[:ss[.SSS]][Z|±HH:MM]`.
 * Partial input (`2024`, `2024-03`, `20240305`) and dates that do not exist
 * (`2024-02-31`) are rejected.
 */
export function parseDateTimeValue(
  input: string,
  kind: 'date' | 'datetime'
): ParseResult<DateTimeValue> {
  const match = VALUE_PATTERN.exec(input.trim());
  const expected =
    kind === 'date' ? 'yyyy-MM-dd' : 'yyyy-MM-dd or yyyy-MM-ddTHH:mm[:ss[.SSS]][Z|±HH:MM]';
  const message = kind === 'date' ? 'Invalid date format' : 'Invalid datetime format';
  if (!match) return err(message, `Expected: ${expected}`);

  const [, year, month, day, time, rawOffset] = match;
  if (!isRealDate(Number(year), Number(month), Number(day))) {
    return err(message, 'The date does not exist');
  }
  const date = `${year}-${month}-${day}`;
  if (time === undefined) return ok({ date });

  if (kind === 'date') return err(message, `Expected: ${expected}`);
  if (!isRealTime(time)) return err(message, 'The time is out of range');
  if (rawOffset === undefined) return ok({ date, time });
  const offset = normalizeOffset(rawOffset);
  if (offset === null) return err(message, 'The offset is out of range');
  return ok({ date, time, offset });
}

/** The canonical string: `T` between date and time, and the offset with a colon. */
export function formatDateTimeValue(value: DateTimeValue): string {
  if (value.time === undefined) return value.date;
  return `${value.date}T${value.time}${value.offset ?? ''}`;
}

function parts(value: DateTimeValue): [number, number, number, number, number, number, number] {
  const [year = 0, month = 1, day = 1] = value.date.split('-').map(Number);
  const [hours = 0, minutes = 0, seconds = 0, millis = 0] = (value.time ?? '')
    .split(/[:.]/)
    .filter(Boolean)
    .map(Number);
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

/** The reading of `instant` on a clock that is `offset` away from UTC. */
export function fromInstant(instant: Date, offset: DateTimeOffset): DateTimeValue {
  const normalized = offsetOfMinutes(minutesOfOffset(offset));
  const wall = new Date(instant.getTime() + minutesOfOffset(normalized) * MS_PER_MINUTE);
  const millis = wall.getUTCMilliseconds();
  return {
    date: `${pad(wall.getUTCFullYear(), 4)}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`,
    time: `${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:${pad(wall.getUTCSeconds())}${
      millis === 0 ? '' : `.${pad(millis, 3)}`
    }`,
    offset: normalized,
  };
}

/** The offset the local time zone has at `at`, so a daylight-saving shift is honoured. */
export function localOffsetAt(at: Date): DateTimeOffset {
  return offsetOfMinutes(-at.getTimezoneOffset());
}

/** Midnight at the start of `date` in the local time zone, with the offset the zone has then. */
export function localMidnight(date: string): DateTimeValue {
  const time = '00:00:00';
  return { date, time, offset: localOffsetAt(toInstant({ date, time })) };
}
