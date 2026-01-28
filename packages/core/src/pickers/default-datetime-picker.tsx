import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker, type Locale } from 'react-day-picker';
import type { DateTimePickerRenderProps } from '../types';
import { calendarClassNames, closeButtonClassName } from './calendar-styles';
import { isSameMonth, parseDate, supportsUTCMode } from './date-format';
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

  // Internal month state for calendar navigation
  const [month, setMonth] = useState<Date>(defaultMonth ?? value ?? new Date());
  const monthRef = useRef(month);
  monthRef.current = month;

  // Auto-sync calendar to value when value changes ("last action wins")
  useEffect(() => {
    if (value && !isSameMonth(value, monthRef.current)) {
      setMonth(value);
    }
  }, [value]);

  const hour24 = fieldDef.timeOptions?.hour24 ?? true;

  const minDate = useMemo(() => {
    if (!fieldDef.minDate) return undefined;
    return typeof fieldDef.minDate === 'string' ? parseDate(fieldDef.minDate) : fieldDef.minDate;
  }, [fieldDef.minDate]);

  const maxDate = useMemo(() => {
    if (!fieldDef.maxDate) return undefined;
    return typeof fieldDef.maxDate === 'string' ? parseDate(fieldDef.maxDate) : fieldDef.maxDate;
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
      const newDate = new Date(date);
      if (isUTC) {
        newDate.setUTCHours(value ? value.getUTCHours() : 0);
        newDate.setUTCMinutes(value ? value.getUTCMinutes() : 0);
        newDate.setUTCSeconds(0);
        newDate.setUTCMilliseconds(0);
      } else {
        newDate.setHours(value?.getHours() ?? 0);
        newDate.setMinutes(value?.getMinutes() ?? 0);
        newDate.setSeconds(0);
        newDate.setMilliseconds(0);
      }
      onChange(newDate);
      // Restore focus to value input and scroll into view
      restoreFocus?.();
    }
  };

  const handleTimeChange = (time: TimeValue) => {
    // Use current value, or fall back to the displayed calendar month (first day)
    // This prevents unexpected "today" when user adjusts time before selecting a date
    const baseDate = value ? new Date(value) : new Date(month.getFullYear(), month.getMonth(), 1);
    if (isUTC) {
      baseDate.setUTCHours(time.hours);
      baseDate.setUTCMinutes(time.minutes);
      baseDate.setUTCSeconds(0);
      baseDate.setUTCMilliseconds(0);
    } else {
      baseDate.setHours(time.hours);
      baseDate.setMinutes(time.minutes);
      baseDate.setSeconds(0);
      baseDate.setMilliseconds(0);
    }
    onChange(baseDate);
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
        selected={value ?? undefined}
        onSelect={handleDateSelect}
        month={month}
        onMonthChange={setMonth}
        disabled={disabled}
        showOutsideDays
        fixedWeeks
        locale={fieldDef.formatConfig?.locale as Locale | undefined}
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
