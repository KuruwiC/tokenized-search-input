'use client';

// Main Component

export { ClearButton, type ClearButtonProps } from './editor/clear-button';
export { TokenizedSearchInput } from './editor/tokenized-search-input';
export type {
  TokenDisplay,
  TokenizedSearchInputProps,
  TokenizedSearchInputRef,
  TokenPatch,
} from './editor/tokenized-search-input.types';

// Date Picker Components

export type { DateTimeOffset, DateTimeValue } from './pickers/date-time-value';
export { DefaultDatePicker } from './pickers/default-date-picker';
export { DefaultDateTimePicker } from './pickers/default-datetime-picker';
export { TimePicker, type TimePickerProps, type TimeValue } from './pickers/time-picker';

// Helpers (React hooks)

export {
  type AsyncTokenResolverOptions,
  type AsyncTokenResolverResult,
  type ResolvedTokenData,
  useAsyncTokenResolver,
} from './helpers/use-async-token-resolver';

// Type Definitions and Constants

export type {
  AtLeastOne,
  BaseDatePickerRenderProps,
  ClassNameSlot,
  ClassNames,
  CreateRuleOptions,
  CustomSuggestion,
  CustomSuggestionConfig,
  CustomSuggestionDisplayMode,
  CustomSuggestionResult,
  CustomSuggestionSelectContext,
  DateFieldDefinition,
  DateFormatConfig,
  DatePickerRenderProps,
  DateTimeFieldDefinition,
  DateTimeFormatConfig,
  DateTimePickerRenderProps,
  DateTimeTimeControls,
  DefaultOperator,
  EnumFieldDefinition,
  EnumResolverContext,
  EnumValue,
  EnumValueResolver,
  EnumValueWithLabel,
  ExistingToken,
  ExistingTokenWithId,
  FieldDefinition,
  FieldSuggestionListProps,
  FieldType,
  FilterToken,
  FilterTokenAttrs,
  FreeTextMode,
  FreeTextToken,
  LabelResolver,
  LabelResolverContext,
  LabelsConfig,
  Matcher,
  Operator,
  OperatorLabelConfig,
  OperatorLabels,
  PaginationLabels,
  ParsedToken,
  PickersConfig,
  QuerySnapshot,
  QuerySnapshotFilterToken,
  QuerySnapshotFreeTextToken,
  QuerySnapshotPlainText,
  QuerySnapshotSegment,
  SerializationConfig,
  SimpleFieldDefinition,
  SuggestContext,
  SuggestContextWithPagination,
  SuggestedFilterToken,
  SuggestFnReturn,
  SuggestionErrorContext,
  SuggestionsConfig,
  TokenLabelDisplay,
  TokenType,
  UnknownFieldTemplate,
  ValidationAction,
  ValidationConfig,
  ValidationContext,
  ValidationRule,
  ValidationToken,
  ValueSuggestionListProps,
  Violation,
  ViolationTarget,
} from './types';
export {
  ALL_OPERATORS,
  DEFAULT_OPERATOR_LABELS,
  DEFAULT_OPERATORS,
  DEFAULT_TOKEN_DELIMITER,
} from './types';

// Editor Commands
// The commands these modules add to Tiptap's `Commands` are part of the type of the editor
// that `getEditor()` returns, so the published declarations carry their augmentations.

import './extensions/token-commands';
import './tokens/filter-token/filter-token-node';
import './tokens/free-text-token/free-text-token-node';

// Callback Types

export type { SerializeTokenFn } from './extensions/clipboard-serializer';
export type { DeserializeTextFn } from './extensions/editor-context';
