import { useEffect, useMemo, useState } from 'react';
import { toCalendarDay } from '../pickers/calendar-days';
import type { DateTimeValue } from '../pickers/date-time-value';
import { parseDateForNavigation, parseDateTimeForNavigation } from '../pickers/navigation-parsers';

/**
 * Result of picker synchronization.
 */
export interface PickerSyncResult {
  /** The value the picker shows, or undefined when there is nothing to show */
  value: DateTimeValue | undefined;
  /** The value the input spells out in full, or null while it is partial or not a value */
  complete: DateTimeValue | null;
}

/**
 * Options for useDebouncedPickerSync hook.
 */
export interface UseDebouncedPickerSyncOptions {
  /** The input value to read */
  inputValue: string;
  /** Value last chosen from the picker */
  selectedValue: DateTimeValue | null;
  /** Suggestion type: 'date' or 'datetime' */
  type: 'date' | 'datetime' | null;
  /** Reads a complete value from the input, or returns null when the input is not one */
  parse: (input: string) => DateTimeValue | null;
  /** Debounce delay in ms for following partial input (default: 200) */
  delay?: number;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Where the picker should move for partial input such as `2024-03` or `2024-03-05T11:3`.
 * It only points the calendar somewhere; the input is not a value yet.
 */
function navigationTarget(input: string, type: 'date' | 'datetime'): DateTimeValue | null {
  if (type === 'date') {
    const date = parseDateForNavigation(input);
    return date ? { date: toCalendarDay(date) } : null;
  }
  const { date, time } = parseDateTimeForNavigation(input);
  if (!date) return null;
  return time
    ? { date: toCalendarDay(date), time: `${pad(time.hours)}:${pad(time.minutes)}` }
    : { date: toCalendarDay(date) };
}

/**
 * Hook for synchronizing picker state with the input value.
 *
 * Priority order:
 * 1. A complete value in the input, at once, with its time and offset
 * 2. Where partial input points, once the input has settled for `delay`
 * 3. The value last chosen from the picker
 * 4. undefined
 *
 * @example
 * ```tsx
 * const { value } = useDebouncedPickerSync({
 *   inputValue: valueFromInput,
 *   selectedValue: pickerValue,
 *   type: 'datetime',
 *   parse,
 * });
 * ```
 */
export function useDebouncedPickerSync({
  inputValue,
  selectedValue,
  type,
  parse,
  delay = 200,
}: UseDebouncedPickerSyncOptions): PickerSyncResult {
  const [debouncedValue, setDebouncedValue] = useState(inputValue);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(inputValue), delay);
    return () => clearTimeout(timer);
  }, [inputValue, delay]);

  const complete = useMemo(
    () => (type && inputValue ? parse(inputValue) : null),
    [type, inputValue, parse]
  );
  const partial = useMemo(
    () => (type && debouncedValue ? navigationTarget(debouncedValue.trim(), type) : null),
    [type, debouncedValue]
  );

  return { value: complete ?? partial ?? selectedValue ?? undefined, complete };
}
