import { type FC, useEffect, useMemo, useState } from 'react';

export interface TimeValue {
  hours: number;
  minutes: number;
}

export interface TimePickerProps {
  value: TimeValue | null;
  onChange: (time: TimeValue) => void;
  hour24?: boolean;
  disabled?: boolean;
}

/**
 * Format TimeValue to HH:MM string for input[type="time"]
 */
const formatTimeValue = (time: TimeValue | null): string => {
  if (!time) return '';
  return `${time.hours.toString().padStart(2, '0')}:${time.minutes.toString().padStart(2, '0')}`;
};

/**
 * Parse HH:MM string to TimeValue with range validation
 */
const parseTimeString = (str: string): TimeValue | null => {
  if (!str) return null;
  const [hours, minutes] = str.split(':').map(Number);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return { hours, minutes };
};

/**
 * Time picker using native HTML input[type="time"].
 *
 * Uses browser's native time picker which is:
 * - Well-tested across all browsers
 * - Provides native mobile UI (wheel picker on iOS, clock on Android)
 * - Handles keyboard navigation automatically
 * - Accessible by default
 *
 * When hour24=false, an AM/PM toggle button is displayed alongside the input.
 *
 * @see https://daypicker.dev/docs/time-pickers
 */
export const TimePicker: FC<TimePickerProps> = ({
  value,
  onChange,
  hour24 = true,
  disabled = false,
}) => {
  // Local state for immediate input responsiveness
  const [localValue, setLocalValue] = useState<string>(() => formatTimeValue(value));
  const [isEditing, setIsEditing] = useState(false);

  // Derive effective time from localValue (if valid) or fallback to value
  const parsedLocal = useMemo(() => parseTimeString(localValue), [localValue]);
  const effectiveTime = parsedLocal ?? value;
  const isPM = (effectiveTime?.hours ?? 0) >= 12;

  // Sync with external value when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(formatTimeValue(value));
    }
  }, [value, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // input[type="time"] returns valid HH:MM format, so we can notify immediately
    const parsed = parseTimeString(newValue);
    if (parsed) {
      onChange(parsed);
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const parsed = parseTimeString(localValue);
    if (!parsed) {
      // Rollback only when invalid
      setLocalValue(formatTimeValue(value));
    }
    // Valid values are already notified via handleChange
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const togglePeriod = () => {
    if (!effectiveTime) return;
    const normalizedHours = effectiveTime.hours % 12;
    const newHours = isPM ? normalizedHours : normalizedHours + 12;
    const newTime = { hours: newHours, minutes: effectiveTime.minutes };
    setLocalValue(formatTimeValue(newTime));
    onChange(newTime);
  };

  return (
    <div className="tsi-time-picker">
      <input
        type="time"
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={hour24 ? 'Time (24-hour format)' : 'Time (12-hour format)'}
        className="tsi-time-input"
      />
      {!hour24 && (
        <button
          type="button"
          onClick={togglePeriod}
          disabled={disabled || !effectiveTime}
          aria-label={isPM ? 'Switch to AM' : 'Switch to PM'}
          className="tsi-time-ampm-btn"
        >
          {isPM ? 'PM' : 'AM'}
        </button>
      )}
    </div>
  );
};
