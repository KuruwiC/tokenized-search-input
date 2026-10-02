import { calendarDayToDate } from '../pickers/calendar-days';
import type { DateTimeValue } from '../pickers/date-time-value';
import { DefaultDatePicker } from '../pickers/default-date-picker';
import { DefaultDateTimePicker } from '../pickers/default-datetime-picker';
import {
  DEFAULT_CATEGORY,
  type SuggestionEntry,
  type SuggestionState,
  type SuggestionType,
  suggestionEntries,
} from '../plugins/suggestion-plugin';
import type {
  ClassNames,
  CustomSuggestion,
  DateFieldDefinition,
  DatePickerRenderProps,
  DateTimeFieldDefinition,
  DateTimePickerRenderProps,
  FieldDefinition,
  PaginationLabels,
} from '../types';
import { cn } from '../utils/cn';
import { getEnumValue } from '../utils/enum-value';
import { CustomSuggestionItem, CustomSuggestionLoadMore } from './custom-suggestion-list';
import { FieldSuggestionItem } from './field-suggestion-list';
import { type SuggestionGroup, SuggestionList } from './suggestion-list';
import { ValueSuggestionItem } from './value-suggestion-list';

export interface SuggestionContentProps {
  type: SuggestionType;
  items: SuggestionState['items'];
  customItems: readonly CustomSuggestion[];
  activeIndex: number;
  query: string;
  fieldKey: string | null;
  dateValue: DateTimeValue | null;
  customDisplayMode: 'prepend' | 'append' | null;
  fields: FieldDefinition[];
  classNames?: ClassNames;
  onFieldSelect: (field: FieldDefinition) => void;
  onValueSelect: (value: string) => void;
  onCustomSelect?: (suggestion: CustomSuggestion) => void;
  onActiveChange: (index: number) => void;
  customHasMore?: boolean;
  customIsLoadingMore?: boolean;
  onCustomLoadMore?: () => void;
  paginationLabels?: PaginationLabels;
  /** Stable ids shared by the listbox and its active options. */
  listboxId: string;
  optionIdPrefix: string;
  /** What the input says the picker should show, ahead of `dateValue` */
  syncedValue: DateTimeValue | null | undefined;
  renderDatePicker?: (props: DatePickerRenderProps) => React.ReactNode;
  renderDateTimePicker?: (props: DateTimePickerRenderProps) => React.ReactNode;
  onDateChange: (value: DateTimeValue | null) => void;
  onDateClose: () => void;
  restoreFocus: () => void;
  isUTC: boolean;
  onUTCChange: (value: boolean) => void;
  includeTime: boolean;
  onIncludeTimeChange: (value: boolean) => void;
}

export function renderSuggestionContent({
  type,
  items,
  customItems,
  activeIndex,
  query,
  fieldKey,
  dateValue,
  customDisplayMode,
  fields,
  classNames,
  onFieldSelect,
  onValueSelect,
  onCustomSelect,
  onActiveChange,
  customHasMore,
  customIsLoadingMore,
  onCustomLoadMore,
  paginationLabels,
  listboxId,
  optionIdPrefix,
  syncedValue,
  renderDatePicker,
  renderDateTimePicker,
  onDateChange,
  onDateClose,
  restoreFocus,
  isUTC,
  onUTCChange,
  includeTime,
  onIncludeTimeChange,
}: SuggestionContentProps) {
  const shown = syncedValue ?? dateValue;
  const defaultMonth = shown ? calendarDayToDate(shown.date) : new Date();

  switch (type) {
    case 'field':
    case 'value':
    case 'custom':
    case 'fieldWithCustom': {
      if ((type === 'custom' || type === 'fieldWithCustom') && !onCustomSelect) return null;
      const entries = suggestionEntries({ type, items, customItems, customDisplayMode });
      const getGroup = groupOf(entries, type, customDisplayMode, classNames);
      const hasCustom = entries.some((entry) => entry.kind === 'custom');
      return (
        <SuggestionList
          items={entries}
          activeIndex={activeIndex}
          onActiveChange={onActiveChange}
          onSelect={(entry) => {
            switch (entry.kind) {
              case 'field':
                return onFieldSelect(entry.field);
              case 'value':
                return onValueSelect(getEnumValue(entry.value));
              case 'custom':
                return onCustomSelect?.(entry.suggestion);
            }
          }}
          getKey={(entry) => entry.key}
          getGroup={getGroup}
          getOptionClassName={(entry) =>
            cn(entry.kind === 'custom' && 'tsi-custom-suggestion-item', classNames?.suggestionItem)
          }
          dividerClassName={classNames?.divider}
          footer={
            hasCustom && customHasMore && onCustomLoadMore ? (
              <CustomSuggestionLoadMore
                isLoadingMore={customIsLoadingMore ?? false}
                onLoadMore={onCustomLoadMore}
                labels={paginationLabels}
              />
            ) : undefined
          }
          renderItem={(entry) => {
            switch (entry.kind) {
              case 'field':
                return (
                  <FieldSuggestionItem
                    field={entry.field}
                    iconClassName={classNames?.suggestionItemIcon}
                    hintClassName={classNames?.suggestionItemHint}
                  />
                );
              case 'value':
                return <ValueSuggestionItem item={entry.value} currentValue={query} />;
              case 'custom':
                return (
                  <CustomSuggestionItem
                    suggestion={entry.suggestion}
                    descriptionClassName={classNames?.suggestionItemDescription}
                  />
                );
            }
          }}
          listboxId={listboxId}
          optionIdPrefix={optionIdPrefix}
        />
      );
    }
    case 'date': {
      const field = fields.find((f) => f.key === fieldKey) as DateFieldDefinition | undefined;
      if (!field) return null;
      const props: DatePickerRenderProps = {
        value: shown,
        onChange: onDateChange,
        onClose: onDateClose,
        fieldDef: field,
        restoreFocus,
        defaultMonth,
        confirmedValue: dateValue,
      };
      if (field.renderPicker) {
        return field.renderPicker(props);
      }
      if (renderDatePicker) {
        return renderDatePicker(props);
      }
      return <DefaultDatePicker {...props} />;
    }
    case 'datetime': {
      const field = fields.find((f) => f.key === fieldKey) as DateTimeFieldDefinition | undefined;
      if (!field) return null;
      const props: DateTimePickerRenderProps = {
        value: shown,
        onChange: onDateChange,
        onClose: onDateClose,
        fieldDef: field,
        timeControls: { isUTC, onUTCChange, includeTime, onIncludeTimeChange },
        restoreFocus,
        defaultMonth,
        confirmedValue: dateValue,
      };
      if (field.renderPicker) {
        return field.renderPicker(props);
      }
      if (renderDateTimePicker) {
        return renderDateTimePicker(props);
      }
      return <DefaultDateTimePicker {...props} />;
    }
    default:
      return null;
  }
}

/**
 * How the entries of a list fall into groups: the fields by category, named when there is
 * more than the default category, and the custom suggestions of a mixed list, divided from
 * the fields.
 */
function groupOf(
  entries: SuggestionEntry[],
  type: SuggestionType,
  customDisplayMode: 'prepend' | 'append' | null,
  classNames: ClassNames | undefined
): (entry: SuggestionEntry) => SuggestionGroup | undefined {
  const categories: string[] = [];
  for (const entry of entries) {
    if (entry.kind === 'field' && !categories.includes(entry.category)) {
      categories.push(entry.category);
    }
  }
  const named =
    categories.length > 1 || (categories.length === 1 && categories[0] !== DEFAULT_CATEGORY);
  const mixed = type === 'fieldWithCustom';
  const prepend = customDisplayMode === 'prepend';
  const hasCustom = entries.some((entry) => entry.kind === 'custom');

  return (entry) => {
    if (entry.kind === 'custom') {
      return mixed ? { key: 'custom', separated: !prepend && categories.length > 0 } : undefined;
    }
    if (entry.kind === 'value') return undefined;
    const index = categories.indexOf(entry.category);
    return {
      key: `field:${entry.category}`,
      label: named ? entry.category : undefined,
      labelClassName: cn(index > 0 && 'tsi-field-category--separated', classNames?.fieldCategory),
      separated: mixed && prepend && index === 0 && hasCustom,
    };
  };
}
