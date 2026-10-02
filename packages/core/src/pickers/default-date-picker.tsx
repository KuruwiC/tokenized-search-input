import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { Check } from '../icons/check';
import { ChevronLeft } from '../icons/chevron-left';
import { ChevronRight } from '../icons/chevron-right';
import type { DatePickerRenderProps } from '../types';
import { calendarDayToDate, createDayMatcher, toCalendarDay } from './calendar-days';
import { calendarClassNames, closeButtonClassName } from './calendar-styles';
import { isSameMonth } from './date-format';

/**
 * Default date picker component using react-day-picker.
 * Can be replaced by user's custom picker via fieldDef.renderPicker.
 *
 * The picker manages its own calendar month state internally.
 * When `value` changes from external input, the calendar auto-syncs to show that month.
 */
export const DefaultDatePicker: FC<DatePickerRenderProps> = ({
  value,
  onChange,
  onClose,
  fieldDef,
  defaultMonth,
  restoreFocus,
}) => {
  const day = value?.date;
  const selectedDate = useMemo(() => (day ? calendarDayToDate(day) : undefined), [day]);

  // Internal month state for calendar navigation
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
    () => createDayMatcher({ minDate, maxDate, disabledDates }, false),
    [minDate, maxDate, disabledDates]
  );

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange({ date: toCalendarDay(date) });
      // Restore focus to value input and scroll into view
      restoreFocus?.();
    }
  };

  return (
    <div className="tsi-picker-body" data-date-picker>
      <DayPicker
        mode="single"
        selected={selectedDate}
        onSelect={handleSelect}
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

      <div className="tsi-picker-footer">
        <button type="button" onClick={onClose} className={closeButtonClassName}>
          {fieldDef.closeButtonLabel ?? <Check className="tsi-picker-close-btn__icon" />}
        </button>
      </div>
    </div>
  );
};
