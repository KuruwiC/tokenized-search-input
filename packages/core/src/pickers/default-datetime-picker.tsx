import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateTimePickerRenderProps } from '../types';
import { calendarClassNames, closeButtonClassName } from './calendar-styles';
import { isSameMonth, parseISOToDate, supportsUTCMode } from './date-format';
import { TimePicker, type TimeValue } from './time-picker';

/**
 * Default datetime picker component using react-day-picker with time selection.
 * Can be replaced by user's custom picker via fieldDef.renderPicker.
 *
 * The picker manages its own calendar month state internally.
 * When `value` changes from external input, the calendar auto-syncs to show that month.
 * Time is derived directly from `value`.
 */
export const DefaultDateTimePicker: FC<DateTimePickerRenderProps> = ({
  value,
  onChange,
  onClose,
  fieldDef,
  timeControls,
  restoreFocus,
  defaultMonth,
}) => {
  const { isUTC, onUTCChange, includeTime, onIncludeTimeChange } = timeControls;
  const timePickerContainerRef = useRef<HTMLFieldSetElement>(null);

  // Time is always enabled when timeRequired, otherwise controlled by includeTime checkbox
  const showIncludeTimeCheckbox = !fieldDef.timeRequired;
  const isTimeEnabled = fieldDef.timeRequired || includeTime;

  // Convert value to local date for calendar display (UTC mode aware)
  const valueAsLocalDate = useMemo(() => {
    if (!value) return null;
    if (isUTC) {
      return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
    }
    return value;
  }, [value, isUTC]);

  // Internal month state for calendar navigation
  const [month, setMonth] = useState<Date>(defaultMonth ?? valueAsLocalDate ?? new Date());
  const monthRef = useRef(month);
  monthRef.current = month;

  // Auto-sync calendar to value when value changes ("last action wins")
  useEffect(() => {
    if (valueAsLocalDate && !isSameMonth(valueAsLocalDate, monthRef.current)) {
      setMonth(valueAsLocalDate);
    }
  }, [valueAsLocalDate]);

  const hour24 = fieldDef.timeOptions?.hour24 ?? true;

  const minDate = useMemo(() => {
    if (!fieldDef.minDate) return undefined;
    return typeof fieldDef.minDate === 'string'
      ? parseISOToDate(fieldDef.minDate)
      : fieldDef.minDate;
  }, [fieldDef.minDate]);

  const maxDate = useMemo(() => {
    if (!fieldDef.maxDate) return undefined;
    return typeof fieldDef.maxDate === 'string'
      ? parseISOToDate(fieldDef.maxDate)
      : fieldDef.maxDate;
  }, [fieldDef.maxDate]);

  const disabled = useMemo(() => {
    return (date: Date): boolean => {
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;
      if (fieldDef.disabledDates?.(date)) return true;
      return false;
    };
  }, [minDate, maxDate, fieldDef.disabledDates]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      let newDate: Date;
      if (isUTC) {
        // Calendar returns a Date in local timezone (e.g., "Jan 15 00:00 JST").
        // Extract the visible year/month/day and construct a UTC Date directly.
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        // Use localTime when time is enabled, otherwise 00:00:00
        const hours = isTimeEnabled ? (localTime?.hours ?? 0) : 0;
        const minutes = isTimeEnabled ? (localTime?.minutes ?? 0) : 0;
        newDate = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
      } else {
        newDate = new Date(date);
        // Use localTime when time is enabled, otherwise 00:00:00
        newDate.setHours(isTimeEnabled ? (localTime?.hours ?? 0) : 0);
        newDate.setMinutes(isTimeEnabled ? (localTime?.minutes ?? 0) : 0);
        newDate.setSeconds(0);
        newDate.setMilliseconds(0);
      }
      onChange(newDate);
      // Restore focus to value input and scroll into view
      restoreFocus?.();
    }
  };

  const handleTimeChange = (time: TimeValue) => {
    // Update local time state
    setLocalTime(time);

    // Use current value, or fall back to the displayed calendar month (first day)
    // This prevents unexpected "today" when user adjusts time before selecting a date
    let newDate: Date;
    if (isUTC) {
      // Extract UTC date parts from value, or use calendar month's visible date
      const baseYear = value ? value.getUTCFullYear() : month.getFullYear();
      const baseMonth = value ? value.getUTCMonth() : month.getMonth();
      const baseDay = value ? value.getUTCDate() : 1;
      newDate = new Date(Date.UTC(baseYear, baseMonth, baseDay, time.hours, time.minutes, 0, 0));
    } else {
      newDate = value ? new Date(value) : new Date(month.getFullYear(), month.getMonth(), 1);
      newDate.setHours(time.hours);
      newDate.setMinutes(time.minutes);
      newDate.setSeconds(0);
      newDate.setMilliseconds(0);
    }
    onChange(newDate);
  };

  // Local time state - preserved even when includeTime is unchecked
  const [localTime, setLocalTime] = useState<TimeValue | null>(() => {
    if (!value) return null;
    if (isUTC) {
      return { hours: value.getUTCHours(), minutes: value.getUTCMinutes() };
    }
    return { hours: value.getHours(), minutes: value.getMinutes() };
  });

  // Sync localTime when value changes with time (datetime format)
  useEffect(() => {
    if (!value) return;
    const newTime = isUTC
      ? { hours: value.getUTCHours(), minutes: value.getUTCMinutes() }
      : { hours: value.getHours(), minutes: value.getMinutes() };
    // Only update if the time actually changed (avoid resetting when date-only value comes in)
    if (newTime.hours !== 0 || newTime.minutes !== 0) {
      setLocalTime(newTime);
    }
  }, [value, isUTC]);

  // Track previous includeTime to detect checkbox toggle
  const prevIncludeTimeRef = useRef(includeTime);
  useEffect(() => {
    const wasIncludeTime = prevIncludeTimeRef.current;
    prevIncludeTimeRef.current = includeTime;

    // When includeTime is toggled, update value with localTime
    if (wasIncludeTime !== includeTime && value) {
      let newDate: Date;
      if (isUTC) {
        const year = value.getUTCFullYear();
        const m = value.getUTCMonth();
        const day = value.getUTCDate();
        const hours = includeTime ? (localTime?.hours ?? 0) : 0;
        const minutes = includeTime ? (localTime?.minutes ?? 0) : 0;
        newDate = new Date(Date.UTC(year, m, day, hours, minutes, 0, 0));
      } else {
        newDate = new Date(value);
        newDate.setHours(includeTime ? (localTime?.hours ?? 0) : 0);
        newDate.setMinutes(includeTime ? (localTime?.minutes ?? 0) : 0);
        newDate.setSeconds(0);
        newDate.setMilliseconds(0);
      }
      onChange(newDate);
    }
  }, [includeTime, value, isUTC, localTime, onChange]);

  // Use localTime for display (preserved even when includeTime is off)
  const currentTime = localTime;

  // Restore focus when leaving TimePicker (blur to outside of TimePicker container)
  const handleTimePickerBlur = (e: React.FocusEvent) => {
    if (!timePickerContainerRef.current?.contains(e.relatedTarget as Node)) {
      restoreFocus?.();
    }
  };

  // Restore focus on Enter/Escape in TimePicker
  const handleTimePickerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      restoreFocus?.();
    }
  };

  return (
    <div className="tsi-picker-body" data-datetime-picker role="dialog">
      <DayPicker
        mode="single"
        selected={valueAsLocalDate ?? undefined}
        onSelect={handleDateSelect}
        month={month}
        onMonthChange={setMonth}
        disabled={disabled}
        showOutsideDays
        fixedWeeks
        components={{
          Chevron: ({ orientation }) =>
            orientation === 'left' ? (
              <ChevronLeft className="tsi-calendar-chevron" />
            ) : (
              <ChevronRight className="tsi-calendar-chevron" />
            ),
        }}
        classNames={calendarClassNames}
      />

      <div className="tsi-datetime-controls">
        {showIncludeTimeCheckbox && (
          <label className="tsi-include-time-label">
            <input
              type="checkbox"
              checked={includeTime}
              onChange={(e) => onIncludeTimeChange(e.target.checked)}
              className="tsi-include-time-checkbox"
            />
            Include time
          </label>
        )}

        <div className="tsi-datetime-row">
          <fieldset
            ref={timePickerContainerRef}
            onBlur={handleTimePickerBlur}
            onKeyDown={handleTimePickerKeyDown}
          >
            <TimePicker
              value={currentTime}
              onChange={handleTimeChange}
              hour24={hour24}
              disabled={!isTimeEnabled}
            />
          </fieldset>
          {supportsUTCMode(fieldDef.formatConfig) && (
            <label className="tsi-utc-label">
              <input
                type="checkbox"
                checked={isUTC}
                onChange={(e) => {
                  onUTCChange(e.target.checked);
                  restoreFocus?.();
                }}
                className="tsi-utc-checkbox"
                disabled={!isTimeEnabled}
              />
              UTC
            </label>
          )}
        </div>

        <div className="tsi-picker-footer">
          <button type="button" onClick={onClose} className={closeButtonClassName}>
            {fieldDef.closeButtonLabel ?? <Check className="tsi-picker-close-btn__icon" />}
          </button>
        </div>
      </div>
    </div>
  );
};
