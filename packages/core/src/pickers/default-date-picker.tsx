import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DatePickerRenderProps } from '../types';
import { calendarClassNames, closeButtonClassName } from './calendar-styles';
import { isSameMonth, parseISOToDate } from './date-format';

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

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(date);
      // Restore focus to value input and scroll into view
      restoreFocus?.();
    }
  };

  return (
    <div className="tsi-picker-body" data-date-picker role="dialog">
      <DayPicker
        mode="single"
        selected={value ?? undefined}
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
