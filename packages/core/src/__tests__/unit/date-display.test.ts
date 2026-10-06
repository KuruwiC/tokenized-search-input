import { describe, expect, it } from 'vitest';
import { getDateDisplayValue, getDateTimeDisplayValue } from '../../pickers/date-format';
import type { DateTimeValue } from '../../pickers/date-time-value';

describe('getDateDisplayValue', () => {
  it('shows the date', () => {
    expect(getDateDisplayValue({ date: '2024-03-05' })).toBe('2024-03-05');
  });

  it('uses the format of the config with the typed value', () => {
    const format = (value: { date: string }) => `on ${value.date}`;
    expect(getDateDisplayValue({ date: '2024-03-05' }, { format })).toBe('on 2024-03-05');
  });

  it('falls back to the date when the format throws', () => {
    const format = () => {
      throw new Error('boom');
    };
    expect(getDateDisplayValue({ date: '2024-03-05' }, { format })).toBe('2024-03-05');
  });
});

describe('getDateTimeDisplayValue', () => {
  it('shows a date without a time as a date', () => {
    expect(getDateTimeDisplayValue({ date: '2024-03-05' })).toBe('2024-03-05');
  });

  it('shows a time without an offset as it is', () => {
    expect(getDateTimeDisplayValue({ date: '2024-03-05', time: '14:30:45' })).toBe(
      '2024-03-05 14:30'
    );
  });

  it('shows UTC in UTC, whatever the local time zone is', () => {
    expect(getDateTimeDisplayValue({ date: '2024-03-05', time: '14:30:00', offset: 'Z' })).toBe(
      '2024-03-05 14:30 (UTC)'
    );
  });

  it('shows another offset in that offset, whatever the local time zone is', () => {
    expect(
      getDateTimeDisplayValue({ date: '2024-03-05', time: '14:30:00', offset: '+05:45' })
    ).toBe('2024-03-05 14:30 (+05:45)');
    expect(
      getDateTimeDisplayValue({ date: '2024-03-05', time: '23:15:00', offset: '-08:00' })
    ).toBe('2024-03-05 23:15 (-08:00)');
  });

  it('leaves out the offset when it is the local one', () => {
    expect(
      getDateTimeDisplayValue({ date: '2024-03-05', time: '14:30:00', offset: '-05:00' })
    ).toBe('2024-03-05 14:30');
    expect(
      getDateTimeDisplayValue({ date: '2024-07-05', time: '14:30:00', offset: '-04:00' })
    ).toBe('2024-07-05 14:30');
  });

  it('names the offset the local time zone has at another time of the year', () => {
    expect(
      getDateTimeDisplayValue({ date: '2024-07-05', time: '14:30:00', offset: '-05:00' })
    ).toBe('2024-07-05 14:30 (-05:00)');
  });

  it('uses the format of the config with the typed value', () => {
    const value: DateTimeValue = { date: '2024-03-05', time: '14:30:00', offset: 'Z' };
    const format = (v: DateTimeValue) => `${v.date}/${v.time}/${v.offset}`;
    expect(getDateTimeDisplayValue(value, { format })).toBe('2024-03-05/14:30:00/Z');
  });

  it('falls back to the canonical string when the format throws', () => {
    const format = () => {
      throw new Error('boom');
    };
    expect(
      getDateTimeDisplayValue(
        { date: '2024-03-05', time: '14:30:00', offset: '+09:00' },
        { format }
      )
    ).toBe('2024-03-05T14:30:00+09:00');
    expect(getDateTimeDisplayValue({ date: '2024-03-05', time: '14:30:00' }, { format })).toBe(
      '2024-03-05T14:30:00'
    );
    expect(getDateTimeDisplayValue({ date: '2024-03-05' }, { format })).toBe('2024-03-05');
  });
});
