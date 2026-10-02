import { calendarDayToDate } from '../pickers/calendar-days';
import type { DateTimeValue } from '../pickers/date-time-value';
import { DefaultDatePicker } from '../pickers/default-date-picker';
import { DefaultDateTimePicker } from '../pickers/default-datetime-picker';
import type { SuggestionType } from '../plugins/suggestion-plugin';
import type {
  ClassNames,
  CustomSuggestion,
  DateFieldDefinition,
  DatePickerRenderProps,
  DateTimeFieldDefinition,
  DateTimePickerRenderProps,
  EnumValue,
  FieldDefinition,
  PaginationLabels,
} from '../types';
import { cn } from '../utils/cn';
import { getEnumValue } from '../utils/enum-value';
import {
  CustomSuggestionItem,
  CustomSuggestionLoadMore,
  customSuggestionKey,
} from './custom-suggestion-list';
import {
  FieldSuggestionItem,
  groupFieldsByCategory,
  hasCategoryHeaders,
} from './field-suggestion-list';
import { type SuggestionGroup, SuggestionList } from './suggestion-list';
import { ValueSuggestionItem } from './value-suggestion-list';

export interface SuggestionContentProps {
  type: SuggestionType;
  items: readonly unknown[];
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
      const entries = suggestionEntries({
        type,
        items,
        customItems,
        customDisplayMode,
        classNames,
        customFooter:
          customHasMore && onCustomLoadMore ? (
            <CustomSuggestionLoadMore
              isLoadingMore={customIsLoadingMore ?? false}
              onLoadMore={onCustomLoadMore}
              labels={paginationLabels}
            />
          ) : undefined,
      });
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
          getKey={entryKey}
          getGroup={(entry) => entry.group}
          getOptionClassName={(entry) =>
            cn(entry.kind === 'custom' && 'tsi-custom-suggestion-item', classNames?.suggestionItem)
          }
          dividerClassName={classNames?.divider}
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

type SuggestionEntry =
  | { kind: 'field'; field: FieldDefinition; group: SuggestionGroup | undefined }
  | { kind: 'custom'; suggestion: CustomSuggestion; group: SuggestionGroup | undefined }
  | { kind: 'value'; value: EnumValue; group?: undefined };

function entryKey(entry: SuggestionEntry): string {
  switch (entry.kind) {
    case 'field':
      return `field:${entry.field.key}`;
    case 'value':
      return `value:${getEnumValue(entry.value)}`;
    case 'custom':
      return `custom:${customSuggestionKey(entry.suggestion)}`;
  }
}

interface SuggestionEntriesInput {
  type: 'field' | 'value' | 'custom' | 'fieldWithCustom';
  items: readonly unknown[];
  customItems: readonly CustomSuggestion[];
  customDisplayMode: 'prepend' | 'append' | null;
  classNames: ClassNames | undefined;
  customFooter: React.ReactNode;
}

/**
 * The options of a list suggestion in the order they are shown: custom suggestions before
 * or after the fields, the fields by category. An index into it is the active index.
 */
function suggestionEntries({
  type,
  items,
  customItems,
  customDisplayMode,
  classNames,
  customFooter,
}: SuggestionEntriesInput): SuggestionEntry[] {
  if (type === 'value') {
    return (items as EnumValue[]).map((value) => ({ kind: 'value', value }));
  }

  const prepend = customDisplayMode === 'prepend';
  const mixed = type === 'fieldWithCustom';
  const fieldGroups = type === 'custom' ? [] : groupFieldsByCategory(items as FieldDefinition[]);
  const named = hasCategoryHeaders(fieldGroups);

  const fieldEntries = fieldGroups.flatMap((group, groupIndex): SuggestionEntry[] => {
    const entryGroup: SuggestionGroup = {
      key: `field:${group.category}`,
      label: named ? group.category : undefined,
      labelClassName: cn(
        groupIndex > 0 && 'tsi-field-category--separated',
        classNames?.fieldCategory
      ),
      separated: mixed && prepend && groupIndex === 0 && customItems.length > 0,
    };
    return group.fields.map((field) => ({ kind: 'field', field, group: entryGroup }));
  });

  const customGroup: SuggestionGroup = {
    key: 'custom',
    separated: mixed && !prepend && fieldEntries.length > 0,
    footer: customFooter,
  };
  const customEntries = customItems.map(
    (suggestion): SuggestionEntry => ({ kind: 'custom', suggestion, group: customGroup })
  );

  return prepend ? [...customEntries, ...fieldEntries] : [...fieldEntries, ...customEntries];
}
