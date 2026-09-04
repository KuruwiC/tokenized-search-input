import { describe, expect, it, vi } from 'vitest';
import {
  renderSuggestionContent,
  type SuggestionContentProps,
} from '../../suggestions/suggestion-content';
import type { DateFieldDefinition } from '../../types';

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
  optionIdPrefix: 'test-option',
  syncedDate: undefined,
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
