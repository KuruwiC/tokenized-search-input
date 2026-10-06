import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DateTimeValue } from '../../pickers/date-time-value';
import {
  renderSuggestionContent,
  type SuggestionContentProps,
} from '../../suggestions/suggestion-content';
import type {
  DateFieldDefinition,
  DatePickerRenderProps,
  DateTimeFieldDefinition,
  DateTimePickerRenderProps,
} from '../../types';

const dateField: DateFieldDefinition = {
  key: 'createdAt',
  label: 'Created at',
  type: 'date',
  operators: ['is'],
  renderPicker: () => null,
};

const baseProps: SuggestionContentProps = {
  type: 'date',
  items: [],
  customItems: [],
  activeIndex: -1,
  query: '',
  fieldKey: dateField.key,
  dateValue: null,
  customDisplayMode: null,
  fields: [dateField],
  onFieldSelect: () => {},
  onValueSelect: () => {},
  onActiveChange: () => {},
  listboxId: 'test-listbox',
  optionIdPrefix: 'test-option',
  syncedValue: undefined,
  onDateChange: () => {},
  onDateClose: () => {},
  restoreFocus: () => {},
  isUTC: false,
  onUTCChange: () => {},
  includeTime: false,
  onIncludeTimeChange: () => {},
};

describe('renderSuggestionContent', () => {
  it('preserves an explicit null from a field picker instead of falling back', () => {
    const fallback = vi.fn(() => <div>fallback</div>);

    expect(renderSuggestionContent({ ...baseProps, renderDatePicker: fallback })).toBeNull();
    expect(fallback).not.toHaveBeenCalled();
  });
});

describe('the picker a date or datetime suggestion renders', () => {
  const plainDate: DateFieldDefinition = {
    key: 'due',
    label: 'Due',
    type: 'date',
    operators: ['is'],
  };
  const plainDateTime: DateTimeFieldDefinition = {
    key: 'seen',
    label: 'Seen',
    type: 'datetime',
    operators: ['is'],
  };

  function propsFor(
    type: 'date' | 'datetime',
    field: DateFieldDefinition | DateTimeFieldDefinition,
    overrides: Partial<SuggestionContentProps> = {}
  ): SuggestionContentProps {
    return { ...baseProps, type, fieldKey: field.key, fields: [field], ...overrides };
  }

  function show(props: SuggestionContentProps) {
    return render(renderSuggestionContent(props)).container;
  }

  it.each([
    ['date', 'renderDatePicker'],
    ['datetime', 'renderDateTimePicker'],
  ] as const)('uses the field picker ahead of the shared %s picker', (type, sharedProp) => {
    const field = type === 'date' ? plainDate : plainDateTime;
    const shared = vi.fn(() => <div data-testid="shared" />);
    const container = show(
      propsFor(
        type,
        { ...field, renderPicker: () => <div data-testid="field" /> } as typeof field,
        { [sharedProp]: shared }
      )
    );

    expect(container.querySelector('[data-testid="field"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="shared"]')).toBeNull();
    expect(shared).not.toHaveBeenCalled();
  });

  it.each([
    ['date', 'renderDatePicker'],
    ['datetime', 'renderDateTimePicker'],
  ] as const)('uses the shared %s picker ahead of the default one', (type, sharedProp) => {
    const field = type === 'date' ? plainDate : plainDateTime;
    const container = show(
      propsFor(type, field, { [sharedProp]: () => <div data-testid="shared" /> })
    );

    expect(container.querySelector('[data-testid="shared"]')).not.toBeNull();
    expect(container.querySelector('[data-date-picker], [data-datetime-picker]')).toBeNull();
  });

  it('renders the default date picker when no picker is given', () => {
    const container = show(propsFor('date', plainDate));

    expect(container.querySelector('[data-date-picker]')).not.toBeNull();
  });

  it('renders the default datetime picker when no picker is given', () => {
    const container = show(propsFor('datetime', plainDateTime));

    expect(container.querySelector('[data-datetime-picker]')).not.toBeNull();
  });

  it('does not use the shared date picker for a datetime field, nor the reverse', () => {
    const dateShared = vi.fn(() => <div data-testid="date-shared" />);
    const dateTimeShared = vi.fn(() => <div data-testid="datetime-shared" />);
    const shared = { renderDatePicker: dateShared, renderDateTimePicker: dateTimeShared };

    const dateContainer = show(propsFor('date', plainDate, shared));
    const dateTimeContainer = show(propsFor('datetime', plainDateTime, shared));

    expect(dateContainer.querySelector('[data-testid="date-shared"]')).not.toBeNull();
    expect(dateContainer.querySelector('[data-testid="datetime-shared"]')).toBeNull();
    expect(dateTimeContainer.querySelector('[data-testid="datetime-shared"]')).not.toBeNull();
    expect(dateTimeContainer.querySelector('[data-testid="date-shared"]')).toBeNull();
  });
});

describe('the value a picker is given', () => {
  const confirmed: DateTimeValue = { date: '2024-01-15' };
  const typed: DateTimeValue = { date: '2025-06-03' };

  it.each([
    ['date', 'renderDatePicker'],
    ['datetime', 'renderDateTimePicker'],
  ] as const)('shows the value the input holds and keeps the committed one apart (%s)', (type, sharedProp) => {
    const picker = vi.fn<(props: DatePickerRenderProps | DateTimePickerRenderProps) => null>(
      () => null
    );
    const field: DateFieldDefinition | DateTimeFieldDefinition =
      type === 'date'
        ? { key: 'due', label: 'Due', type: 'date', operators: ['is'] }
        : { key: 'due', label: 'Due', type: 'datetime', operators: ['is'] };

    renderSuggestionContent({
      ...baseProps,
      type,
      fieldKey: 'due',
      fields: [field],
      dateValue: confirmed,
      syncedValue: typed,
      [sharedProp]: picker,
    });

    const props = picker.mock.calls[0]?.[0];
    expect(props?.value).toEqual(typed);
    expect(props?.confirmedValue).toEqual(confirmed);
    expect(props?.defaultMonth).toEqual(new Date(2025, 5, 3));
  });

  it('shows the committed value while the input holds none', () => {
    const picker = vi.fn<(props: DatePickerRenderProps) => null>(() => null);

    renderSuggestionContent({
      ...baseProps,
      fields: [{ ...dateField, renderPicker: undefined }],
      dateValue: confirmed,
      syncedValue: undefined,
      renderDatePicker: picker,
    });

    const props = picker.mock.calls[0]?.[0];
    expect(props?.value).toEqual(confirmed);
    expect(props?.confirmedValue).toEqual(confirmed);
    expect(props?.defaultMonth).toEqual(new Date(2024, 0, 15));
  });
});
