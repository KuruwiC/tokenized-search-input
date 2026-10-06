/**
 * Unit tests for DefaultDateTimePicker: the picker reads and writes DateTimeValue, so the
 * offset and the time of the value survive every change made from the picker.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DefaultDateTimePicker } from '../../pickers/default-datetime-picker';
import type { DateTimeFieldDefinition } from '../../types';

type Props = ComponentProps<typeof DefaultDateTimePicker>;

const field = (extra: Partial<DateTimeFieldDefinition> = {}): DateTimeFieldDefinition => ({
  key: 'at',
  label: 'At',
  type: 'datetime',
  operators: ['is'],
  ...extra,
});

function propsOf(over: Partial<Props> = {}): Props {
  return {
    value: null,
    onChange: vi.fn(),
    onClose: vi.fn(),
    fieldDef: field(),
    timeControls: {
      isUTC: false,
      onUTCChange: vi.fn(),
      includeTime: true,
      onIncludeTimeChange: vi.fn(),
    },
    ...over,
  };
}

const timeInput = () => document.querySelector('input[type="time"]') as HTMLInputElement;
const day = (label: RegExp) => screen.getByRole('button', { name: label });

describe('DefaultDateTimePicker', () => {
  describe('the time it shows', () => {
    it('shows 14:30 for a value with seconds, milliseconds and Z', () => {
      render(
        <DefaultDateTimePicker
          {...propsOf({ value: { date: '2024-03-05', time: '14:30:45.123', offset: 'Z' } })}
        />
      );
      expect(timeInput().value).toBe('14:30');
    });

    it('shows the time of a value with an offset as written, not converted', () => {
      render(
        <DefaultDateTimePicker
          {...propsOf({ value: { date: '2024-03-05', time: '14:30:00', offset: '+09:00' } })}
        />
      );
      expect(timeInput().value).toBe('14:30');
    });

    it('shows 00:00 when the value moves to midnight', () => {
      const props = propsOf({ value: { date: '2024-03-05', time: '14:30' } });
      const { rerender } = render(<DefaultDateTimePicker {...props} />);
      rerender(<DefaultDateTimePicker {...props} value={{ date: '2024-03-05', time: '00:00' }} />);
      expect(timeInput().value).toBe('00:00');
    });

    it('shows no time for a date', () => {
      render(<DefaultDateTimePicker {...propsOf({ value: { date: '2024-03-05' } })} />);
      expect(timeInput().value).toBe('');
    });
  });

  describe('choosing a date', () => {
    it('keeps the offset and the time of a +09:00 value', () => {
      const onChange = vi.fn();
      render(
        <DefaultDateTimePicker
          {...propsOf({
            onChange,
            value: { date: '2024-03-05', time: '14:30:00', offset: '+09:00' },
          })}
        />
      );
      fireEvent.click(day(/March 10th, 2024/));
      expect(onChange).toHaveBeenCalledWith({
        date: '2024-03-10',
        time: '14:30:00',
        offset: '+09:00',
      });
    });

    it('keeps the seconds and milliseconds of the value', () => {
      const onChange = vi.fn();
      render(
        <DefaultDateTimePicker
          {...propsOf({
            onChange,
            value: { date: '2024-03-05', time: '14:30:45.123', offset: 'Z' },
          })}
        />
      );
      fireEvent.click(day(/March 10th, 2024/));
      expect(onChange).toHaveBeenCalledWith({
        date: '2024-03-10',
        time: '14:30:45.123',
        offset: 'Z',
      });
    });

    it('starts a new value at midnight in UTC when UTC is on', () => {
      const onChange = vi.fn();
      render(
        <DefaultDateTimePicker
          {...propsOf({
            onChange,
            defaultMonth: new Date(2024, 2, 1),
            timeControls: {
              isUTC: true,
              onUTCChange: vi.fn(),
              includeTime: true,
              onIncludeTimeChange: vi.fn(),
            },
          })}
        />
      );
      fireEvent.click(day(/March 10th, 2024/));
      expect(onChange).toHaveBeenCalledWith({ date: '2024-03-10', time: '00:00:00', offset: 'Z' });
    });

    it('starts a new value at local midnight with the local offset', () => {
      const onChange = vi.fn();
      render(
        <DefaultDateTimePicker {...propsOf({ onChange, defaultMonth: new Date(2024, 2, 1) })} />
      );
      fireEvent.click(day(/March 10th, 2024/));
      expect(onChange).toHaveBeenCalledWith({
        date: '2024-03-10',
        time: '00:00:00',
        offset: '-05:00',
      });
    });

    it('writes a date alone while the time is not included', () => {
      const onChange = vi.fn();
      render(
        <DefaultDateTimePicker
          {...propsOf({
            onChange,
            value: { date: '2024-03-05' },
            timeControls: {
              isUTC: false,
              onUTCChange: vi.fn(),
              includeTime: false,
              onIncludeTimeChange: vi.fn(),
            },
          })}
        />
      );
      fireEvent.click(day(/March 10th, 2024/));
      expect(onChange).toHaveBeenCalledWith({ date: '2024-03-10' });
    });

    it('selects the cell of the date of the value in its own offset', () => {
      render(
        <DefaultDateTimePicker
          {...propsOf({ value: { date: '2024-03-05', time: '23:30:00', offset: '-08:00' } })}
        />
      );
      expect(screen.getByRole('gridcell', { selected: true })).toContainElement(
        day(/March 5th, 2024/)
      );
    });
  });

  describe('choosing a time', () => {
    it('keeps the date and the offset', () => {
      const onChange = vi.fn();
      render(
        <DefaultDateTimePicker
          {...propsOf({
            onChange,
            value: { date: '2024-03-05', time: '14:30:00', offset: '+09:00' },
          })}
        />
      );
      fireEvent.change(timeInput(), { target: { value: '09:15' } });
      expect(onChange).toHaveBeenCalledWith({
        date: '2024-03-05',
        time: '09:15:00',
        offset: '+09:00',
      });
    });

    it('uses the first day of the displayed month when there is no value yet', () => {
      const onChange = vi.fn();
      render(
        <DefaultDateTimePicker {...propsOf({ onChange, defaultMonth: new Date(2024, 2, 20) })} />
      );
      fireEvent.change(timeInput(), { target: { value: '09:15' } });
      expect(onChange).toHaveBeenCalledWith({
        date: '2024-03-01',
        time: '09:15:00',
        offset: '-05:00',
      });
    });

    it('is disabled while the time is not included', () => {
      render(
        <DefaultDateTimePicker
          {...propsOf({
            timeControls: {
              isUTC: false,
              onUTCChange: vi.fn(),
              includeTime: false,
              onIncludeTimeChange: vi.fn(),
            },
          })}
        />
      );
      expect(timeInput()).toBeDisabled();
    });

    it('is enabled when the field requires a time', () => {
      render(
        <DefaultDateTimePicker
          {...propsOf({
            fieldDef: field({ timeRequired: true }),
            timeControls: {
              isUTC: false,
              onUTCChange: vi.fn(),
              includeTime: false,
              onIncludeTimeChange: vi.fn(),
            },
          })}
        />
      );
      expect(timeInput()).toBeEnabled();
      expect(screen.queryByLabelText(/include time/i)).not.toBeInTheDocument();
    });
  });

  describe('the controls', () => {
    it('reports a change of the include time checkbox', () => {
      const onIncludeTimeChange = vi.fn();
      render(
        <DefaultDateTimePicker
          {...propsOf({
            timeControls: {
              isUTC: false,
              onUTCChange: vi.fn(),
              includeTime: false,
              onIncludeTimeChange,
            },
          })}
        />
      );
      fireEvent.click(screen.getByLabelText(/include time/i));
      expect(onIncludeTimeChange).toHaveBeenCalledWith(true);
    });

    it('reports a change of the UTC checkbox', () => {
      const onUTCChange = vi.fn();
      render(
        <DefaultDateTimePicker
          {...propsOf({
            timeControls: {
              isUTC: false,
              onUTCChange,
              includeTime: true,
              onIncludeTimeChange: vi.fn(),
            },
          })}
        />
      );
      fireEvent.click(screen.getByLabelText('UTC'));
      expect(onUTCChange).toHaveBeenCalledWith(true);
    });
  });

  describe('the days that can be chosen', () => {
    it('leaves March 5 selectable for a maximum of 2024-03-05T15:00', () => {
      render(
        <DefaultDateTimePicker
          {...propsOf({
            value: { date: '2024-03-05' },
            fieldDef: field({ maxDate: '2024-03-05T15:00' }),
          })}
        />
      );
      expect(day(/March 5th, 2024/)).toBeEnabled();
      expect(day(/March 6th, 2024/)).toBeDisabled();
    });

    it('leaves March 5 selectable for a minimum of 2024-03-05T15:00', () => {
      render(
        <DefaultDateTimePicker
          {...propsOf({
            value: { date: '2024-03-05' },
            fieldDef: field({ minDate: '2024-03-05T15:00' }),
          })}
        />
      );
      expect(day(/March 5th, 2024/)).toBeEnabled();
      expect(day(/March 4th, 2024/)).toBeDisabled();
    });

    it('compares a Date maximum by its UTC day while the value is in UTC', () => {
      render(
        <DefaultDateTimePicker
          {...propsOf({
            value: { date: '2024-03-05', time: '10:00', offset: 'Z' },
            fieldDef: field({ maxDate: new Date('2024-03-05T23:30:00Z') }),
            timeControls: {
              isUTC: true,
              onUTCChange: vi.fn(),
              includeTime: true,
              onIncludeTimeChange: vi.fn(),
            },
          })}
        />
      );
      expect(day(/March 5th, 2024/)).toBeEnabled();
      expect(day(/March 6th, 2024/)).toBeDisabled();
    });
  });

  // The suite runs in America/New_York (vitest.config.ts), where the clock moves from 02:00
  // to 03:00 on 2024-03-10.
  describe('across a clock change', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('writes a time the clock skips as the moment the clock moves to', () => {
      const onChange = vi.fn();
      render(<DefaultDateTimePicker {...propsOf({ onChange, value: { date: '2024-03-10' } })} />);
      fireEvent.change(timeInput(), { target: { value: '02:30' } });
      expect(onChange).toHaveBeenLastCalledWith({
        date: '2024-03-10',
        time: '03:30:00',
        offset: '-04:00',
      });
    });

    it('writes local midnight of a day whose midnight the clock skips as the moment the clock moves to', () => {
      // In America/Santiago the clock moves from 00:00 (-04:00) to 01:00 (-03:00) on 2024-09-08.
      vi.stubEnv('TZ', 'America/Santiago');
      const onChange = vi.fn();
      render(
        <DefaultDateTimePicker {...propsOf({ onChange, defaultMonth: new Date(2024, 8, 1) })} />
      );
      fireEvent.click(day(/September 8th, 2024/));
      expect(onChange).toHaveBeenLastCalledWith({
        date: '2024-09-08',
        time: '01:00:00',
        offset: '-03:00',
      });
    });
  });
});
