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
  const { isUTC, onUTCChange } = timeControls;
  const timePickerContainerRef = useRef<HTMLFieldSetElement>(null);

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
        const hours = value?.getUTCHours() ?? 0;
        const minutes = value?.getUTCMinutes() ?? 0;
        const seconds = value?.getUTCSeconds() ?? 0;
        const ms = value?.getUTCMilliseconds() ?? 0;
        newDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds, ms));
      } else {
        newDate = new Date(date);
        newDate.setHours(value?.getHours() ?? 0);
        newDate.setMinutes(value?.getMinutes() ?? 0);
        newDate.setSeconds(value?.getSeconds() ?? 0);
        newDate.setMilliseconds(value?.getMilliseconds() ?? 0);
      }
      onChange(newDate);
      // Restore focus to value input and scroll into view
      restoreFocus?.();
    }
  };

  const handleTimeChange = (time: TimeValue) => {
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

  // Compute time from value (null when no date selected)
  const currentTime: TimeValue | null = useMemo(() => {
    if (!value) return null;
    if (isUTC) {
      return { hours: value.getUTCHours(), minutes: value.getUTCMinutes() };
    }
    return { hours: value.getHours(), minutes: value.getMinutes() };
  }, [value, isUTC]);

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
        <div className="tsi-datetime-row">
          <fieldset
            ref={timePickerContainerRef}
            onBlur={handleTimePickerBlur}
            onKeyDown={handleTimePickerKeyDown}
          >
            <TimePicker value={currentTime} onChange={handleTimeChange} hour24={hour24} />
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
