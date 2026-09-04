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
import { CustomSuggestionList } from './custom-suggestion-list';
import { FieldSuggestionList } from './field-suggestion-list';
import { ValueSuggestionList } from './value-suggestion-list';

export interface SuggestionContentProps {
  type: SuggestionType;
  items: readonly unknown[];
  customItems: readonly CustomSuggestion[];
  activeIndex: number;
  query: string;
  fieldKey: string | null;
  dateValue: Date | null;
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
  optionIdPrefix: string;
  syncedDate: Date | null | undefined;
  renderDatePicker?: (props: DatePickerRenderProps) => React.ReactNode;
  renderDateTimePicker?: (props: DateTimePickerRenderProps) => React.ReactNode;
  onDateChange: (date: Date | null) => void;
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
  optionIdPrefix,
  syncedDate,
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
  switch (type) {
    case 'field':
      return (
        <FieldSuggestionList
          fields={items as FieldDefinition[]}
          onSelect={onFieldSelect}
          activeIndex={activeIndex}
          onActiveChange={onActiveChange}
          itemClassName={classNames?.suggestionItem}
          hintClassName={classNames?.suggestionItemHint}
          iconClassName={classNames?.suggestionItemIcon}
          categoryClassName={classNames?.fieldCategory}
          optionIdPrefix={optionIdPrefix}
        />
      );
    case 'value':
      return (
        <ValueSuggestionList
          items={items as EnumValue[]}
          currentValue={query}
          onSelect={onValueSelect}
          activeIndex={activeIndex}
          onActiveChange={onActiveChange}
          itemClassName={classNames?.suggestionItem}
          optionIdPrefix={optionIdPrefix}
        />
      );
    case 'custom':
      return onCustomSelect ? (
        <CustomSuggestionList
          items={customItems}
          onSelect={onCustomSelect}
          activeIndex={activeIndex}
          onActiveChange={onActiveChange}
          itemClassName={classNames?.suggestionItem}
          descriptionClassName={classNames?.suggestionItemDescription}
          hasMore={customHasMore}
          isLoadingMore={customIsLoadingMore}
          onLoadMore={onCustomLoadMore}
          paginationLabels={paginationLabels}
          optionIdPrefix={optionIdPrefix}
        />
      ) : null;
    case 'fieldWithCustom': {
      if (!onCustomSelect) return null;
      const fieldItems = items as FieldDefinition[];
      const isPrepend = customDisplayMode === 'prepend';
      const customActive = () =>
        isPrepend
          ? activeIndex >= 0 && activeIndex < customItems.length
            ? activeIndex
            : -1
          : activeIndex >= fieldItems.length
            ? activeIndex - fieldItems.length
            : -1;
      const fieldActive = () =>
        isPrepend
          ? activeIndex >= customItems.length
            ? activeIndex - customItems.length
            : -1
          : activeIndex >= 0 && activeIndex < fieldItems.length
            ? activeIndex
            : -1;
      const customChange = (idx: number) =>
        onActiveChange(isPrepend ? idx : idx + fieldItems.length);
      const fieldChange = (idx: number) =>
        onActiveChange(isPrepend ? idx + customItems.length : idx);
      const customList = (offset: number) => (
        <CustomSuggestionList
          items={customItems}
          onSelect={onCustomSelect}
          activeIndex={customActive()}
          onActiveChange={customChange}
          itemClassName={classNames?.suggestionItem}
          descriptionClassName={classNames?.suggestionItemDescription}
          hasMore={customHasMore}
          isLoadingMore={customIsLoadingMore}
          onLoadMore={onCustomLoadMore}
          paginationLabels={paginationLabels}
          optionIdPrefix={optionIdPrefix}
          optionIndexOffset={offset}
        />
      );
      return (
        <>
          {isPrepend && customItems.length > 0 && (
            <>
              {customList(0)}
              {fieldItems.length > 0 && <div className={cn('tsi-divider', classNames?.divider)} />}
            </>
          )}
          {fieldItems.length > 0 && (
            <FieldSuggestionList
              fields={fieldItems}
              onSelect={onFieldSelect}
              activeIndex={fieldActive()}
              onActiveChange={fieldChange}
              itemClassName={classNames?.suggestionItem}
              hintClassName={classNames?.suggestionItemHint}
              iconClassName={classNames?.suggestionItemIcon}
              categoryClassName={classNames?.fieldCategory}
              optionIdPrefix={optionIdPrefix}
              optionIndexOffset={isPrepend ? customItems.length : 0}
            />
          )}
          {!isPrepend && customItems.length > 0 && (
            <>
              {fieldItems.length > 0 && <div className={cn('tsi-divider', classNames?.divider)} />}
              {customList(fieldItems.length)}
            </>
          )}
        </>
      );
    }
    case 'date': {
      const field = fields.find((f) => f.key === fieldKey) as DateFieldDefinition | undefined;
      if (!field) return null;
      const props: DatePickerRenderProps = {
        value: syncedDate ?? dateValue,
        onChange: onDateChange,
        onClose: onDateClose,
        fieldDef: field,
        restoreFocus,
        defaultMonth: syncedDate ?? dateValue ?? new Date(),
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
        value: syncedDate ?? dateValue,
        onChange: onDateChange,
        onClose: onDateClose,
        fieldDef: field,
        timeControls: { isUTC, onUTCChange, includeTime, onIncludeTimeChange },
        restoreFocus,
        defaultMonth: syncedDate ?? dateValue ?? new Date(),
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
