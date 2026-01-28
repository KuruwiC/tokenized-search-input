import { useEffect, useMemo, useState } from 'react';
import { parseDateForNavigation, parseDateTimeForNavigation } from '../pickers/navigation-parsers';

/**
 * Result of picker synchronization.
 */
export interface PickerSyncResult {
  /** Parsed date for display (includes time for datetime type) */
  date: Date | undefined;
}

/**
 * Options for useDebouncedPickerSync hook.
 */
export interface UseDebouncedPickerSyncOptions {
  /** The input value to parse */
  inputValue: string;
  /** Currently selected date from picker */
  selectedDate: Date | null;
  /** Suggestion type: 'date' or 'datetime' */
  type: 'date' | 'datetime' | null;
  /** Whether to interpret time as UTC (for datetime type) */
  isUTC?: boolean;
  /** Debounce delay in ms (default: 200) */
  delay?: number;
}

/**
 * Hook for synchronizing picker state with debounced input value.
 * Parses user input and returns a Date for picker display.
 *
 * For datetime type, the returned date includes both date and time components.
 *
 * Priority order:
 * 1. Parse the debounced input value
 * 2. Fall back to selectedDate if input cannot be parsed
 * 3. Return undefined if neither is available
 *
 * @example
 * ```tsx
 * const { date } = useDebouncedPickerSync({
 *   inputValue: valueFromInput,
 *   selectedDate: pickerValue,
 *   type: 'datetime',
 * });
 * ```
 */
export function useDebouncedPickerSync({
  inputValue,
  selectedDate,
  type,
  isUTC = false,
  delay = 200,
}: UseDebouncedPickerSyncOptions): PickerSyncResult {
  const [debouncedValue, setDebouncedValue] = useState(inputValue);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(inputValue), delay);
    return () => clearTimeout(timer);
  }, [inputValue, delay]);

  const date = useMemo(() => {
    if (debouncedValue && type) {
      if (type === 'datetime') {
        const parsed = parseDateTimeForNavigation(debouncedValue);
        if (parsed.date) {
          // Extract year, month, day from parsed.date (which is in local timezone)
          const year = parsed.date.getFullYear();
          const month = parsed.date.getMonth();
          const day = parsed.date.getDate();
          const hours = parsed.time?.hours ?? 0;
          const minutes = parsed.time?.minutes ?? 0;

          // Build Date in correct timezone context
          if (isUTC) {
            // For UTC, construct using Date.UTC to ensure correct UTC day
            return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
          }
          // For local time, construct normally
          return new Date(year, month, day, hours, minutes, 0, 0);
        }
        // Time-only input without date - cannot display in picker
        return undefined;
      }

      if (type === 'date') {
        return parseDateForNavigation(debouncedValue) ?? undefined;
      }
    }

    return selectedDate ?? undefined;
  }, [selectedDate, debouncedValue, type, isUTC]);

  return { date };
}
