import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedPickerSync } from '../../hooks/use-debounced-picker-sync';
import { type DateTimeValue, parseDateTimeValue } from '../../pickers/date-time-value';

const parse =
  (kind: 'date' | 'datetime') =>
  (input: string): DateTimeValue | null => {
    const result = parseDateTimeValue(input, kind);
    return result.ok ? result.value : null;
  };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedPickerSync', () => {
  it('shows a complete value at once, with its time and offset', () => {
    const { result } = renderHook(() =>
      useDebouncedPickerSync({
        inputValue: '2024-03-05T14:30:45.123Z',
        selectedValue: null,
        type: 'datetime',
        parse: parse('datetime'),
      })
    );
    expect(result.current.value).toEqual({
      date: '2024-03-05',
      time: '14:30:45.123',
      offset: 'Z',
    });
  });

  it('keeps the offset of a value with one', () => {
    const { result } = renderHook(() =>
      useDebouncedPickerSync({
        inputValue: '2024-03-05T14:30:00+0900',
        selectedValue: null,
        type: 'datetime',
        parse: parse('datetime'),
      })
    );
    expect(result.current.value?.offset).toBe('+09:00');
  });

  it('follows a partial date after the delay, for navigation only', () => {
    const { result, rerender } = renderHook(
      ({ inputValue }) =>
        useDebouncedPickerSync({
          inputValue,
          selectedValue: { date: '2024-03-05' },
          type: 'date',
          parse: parse('date'),
          delay: 200,
        }),
      { initialProps: { inputValue: '' } }
    );
    rerender({ inputValue: '2024-07' });
    expect(result.current.value).toEqual({ date: '2024-03-05' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.value).toEqual({ date: '2024-07-01' });
  });

  it('follows a partial datetime with the time typed so far', () => {
    const { result } = renderHook(() =>
      useDebouncedPickerSync({
        inputValue: '2024-07-04T11:3',
        selectedValue: null,
        type: 'datetime',
        parse: parse('datetime'),
      })
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.value).toEqual({ date: '2024-07-04', time: '11:30' });
  });

  it('shows a date without a time while only a date is typed', () => {
    const { result } = renderHook(() =>
      useDebouncedPickerSync({
        inputValue: '2024-07',
        selectedValue: null,
        type: 'datetime',
        parse: parse('datetime'),
      })
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.value).toEqual({ date: '2024-07-01' });
  });

  it('falls back to the selected value when the input says nothing', () => {
    const selected: DateTimeValue = { date: '2024-03-05', time: '10:00', offset: '+09:00' };
    const { result } = renderHook(() =>
      useDebouncedPickerSync({
        inputValue: 'garbage',
        selectedValue: selected,
        type: 'datetime',
        parse: parse('datetime'),
      })
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.value).toBe(selected);
  });

  it('is undefined with no input and no selection', () => {
    const { result } = renderHook(() =>
      useDebouncedPickerSync({
        inputValue: '',
        selectedValue: null,
        type: 'date',
        parse: parse('date'),
      })
    );
    expect(result.current.value).toBeUndefined();
  });

  it('uses the parse it is given for the complete value', () => {
    const { result } = renderHook(() =>
      useDebouncedPickerSync({
        inputValue: 'Jan 15',
        selectedValue: null,
        type: 'date',
        parse: (input) => (input === 'Jan 15' ? { date: '2024-01-15' } : null),
      })
    );
    expect(result.current.value).toEqual({ date: '2024-01-15' });
  });

  it('says which value is complete, as opposed to where partial input points', () => {
    const complete = renderHook(() =>
      useDebouncedPickerSync({
        inputValue: '2024-03-05T14:30:00Z',
        selectedValue: null,
        type: 'datetime',
        parse: parse('datetime'),
      })
    );
    expect(complete.result.current.complete).toEqual({
      date: '2024-03-05',
      time: '14:30:00',
      offset: 'Z',
    });

    const partial = renderHook(() =>
      useDebouncedPickerSync({
        inputValue: '2024-07-04T11:3',
        selectedValue: { date: '2024-03-05', time: '10:00', offset: 'Z' },
        type: 'datetime',
        parse: parse('datetime'),
      })
    );
    expect(partial.result.current.complete).toBeNull();
    expect(partial.result.current.value).toEqual({ date: '2024-07-04', time: '11:30' });
  });
});
