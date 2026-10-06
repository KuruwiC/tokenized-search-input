import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { Check } from '../icons/check';
import { ChevronLeft } from '../icons/chevron-left';
import { ChevronRight } from '../icons/chevron-right';
import type { DateTimePickerRenderProps } from '../types';
import { calendarDayToDate, createDayMatcher, toCalendarDay } from './calendar-days';
import { calendarClassNames, closeButtonClassName } from './calendar-styles';
import { isSameMonth, supportsUTCMode } from './date-format';
import { atLocalTime, type DateTimeValue } from './date-time-value';
import { TimePicker, type TimeValue } from './time-picker';

const START_OF_DAY = '00:00:00';

function toTimeValue(time: string | undefined): TimeValue | null {
  if (time === undefined) return null;
  return { hours: Number(time.slice(0, 2)), minutes: Number(time.slice(3, 5)) };
}

function toTimeString({ hours, minutes }: TimeValue): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

/**
 * Default datetime picker component using react-day-picker with time selection.
 * Can be replaced by user's custom picker via fieldDef.renderPicker.
 *
 * The picker manages its own calendar month state internally.
 * When `value` changes from external input, the calendar auto-syncs to show that month.
 * The calendar day and the time are read from `value` as they are written, and a change
 * keeps the offset of `value`; a value that does not exist yet starts in UTC or in the
 * local offset, as `timeControls.isUTC` says.
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

  const day = value?.date;
  const selectedDate = useMemo(() => (day ? calendarDayToDate(day) : undefined), [day]);
  const time = value?.time;
  const currentTime = useMemo(() => toTimeValue(time), [time]);

  const [month, setMonth] = useState<Date>(defaultMonth ?? selectedDate ?? new Date());
  const monthRef = useRef(month);
  monthRef.current = month;

  // Auto-sync calendar to value when value changes ("last action wins")
  useEffect(() => {
    if (selectedDate && !isSameMonth(selectedDate, monthRef.current)) {
      setMonth(selectedDate);
    }
  }, [selectedDate]);

  const { minDate, maxDate, disabledDates } = fieldDef;
  const disabled = useMemo(
    () => createDayMatcher({ minDate, maxDate, disabledDates }, isUTC),
    [minDate, maxDate, disabledDates, isUTC]
  );

  /**
   * The value for `date` at `at`: in the offset of the current value, else in UTC or in
   * the local zone, where the offset is the one the zone has at that moment.
   */
  const valueAt = (date: string, at: string): DateTimeValue => {
    if (value?.offset !== undefined) return { date, time: at, offset: value.offset };
    return isUTC ? { date, time: at, offset: 'Z' } : atLocalTime(date, at);
  };

  const handleDateSelect = (cell: Date | undefined) => {
    if (!cell) return;
    const date = toCalendarDay(cell);
    onChange(isTimeEnabled ? valueAt(date, time ?? START_OF_DAY) : { date });
    restoreFocus?.();
  };

  const handleTimeChange = (next: TimeValue) => {
    // Use the current value's day, or fall back to the displayed calendar month (first day)
    // This prevents unexpected "today" when user adjusts time before selecting a date
    const date = day ?? `${toCalendarDay(month).slice(0, -2)}01`;
    onChange(valueAt(date, toTimeString(next)));
  };

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
    <div className="tsi-picker-body" data-datetime-picker>
      <DayPicker
        mode="single"
        selected={selectedDate}
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
            <TimePicker value={currentTime} onChange={handleTimeChange} disabled={!isTimeEnabled} />
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
