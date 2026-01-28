// ============================================
// Date Picker Utilities
// ============================================

export {
  createDateTimeValidator,
  createDateValidator,
  DEFAULT_DATE_VALUE_FORMAT,
  DEFAULT_DATETIME_VALUE_FORMAT,
  isDateField,
  isDateOrDateTimeField,
  isDateTimeField,
  parseISOToDate,
  validateDateTimeValue,
  validateDateValue,
} from './pickers/date-format';

// ============================================
// Type Definitions and Constants
// ============================================

export {
  // Operators
  ALL_OPERATORS,
  type AtLeastOne,
  // Fields
  type BaseDatePickerRenderProps,
  // Validation
  type CreateRuleOptions,
  // Suggestions
  type CustomSuggestion,
  type CustomSuggestionConfig,
  type CustomSuggestionDisplayMode,
  type CustomSuggestionResult,
  type CustomSuggestionSelectContext,
  type DateFieldDefinition,
  type DateFormatConfig,
  type DatePickerRenderProps,
  type DateTimeFieldDefinition,
  type DateTimeFormatConfig,
  type DateTimePickerRenderProps,
  type DateTimeTimeControls,
  DEFAULT_OPERATOR_LABELS,
  DEFAULT_OPERATORS,
  // Tokens
  DEFAULT_TOKEN_DELIMITER,
  type DefaultOperator,
  type EnumFieldDefinition,
  type EnumResolverContext,
  type EnumValue,
  type EnumValueResolver,
  type EnumValueWithLabel,
  type ExistingToken,
  type ExistingTokenWithId,
  type ExtendedValidationFn,
  type ExtendedValidationResult,
  type FieldDefinition,
  type FieldRuleOverride,
  type FieldSuggestionListProps,
  type FieldType,
  type FilterToken,
  type FilterTokenAttrs,
  type FreeTextMode,
  type FreeTextToken,
  getOperatorDisplayLabel,
  getOperatorSelectLabel,
  type LabelResolver,
  type LabelResolverContext,
  // Config (grouped props)
  type LabelsConfig,
  type Matcher,
  type OperatorLabelConfig,
  type OperatorLabels,
  type PaginationLabels,
  type ParsedToken,
  type PickersConfig,
  type QuerySnapshot,
  type QuerySnapshotFilterToken,
  type QuerySnapshotFreeTextToken,
  type QuerySnapshotPlainText,
  type QuerySnapshotSegment,
  type SerializationConfig,
  type SimpleFieldDefinition,
  type SimpleToken,
  type SimpleValidationFn,
  type SimpleValidationReturn,
  type SuggestContext,
  type SuggestContextWithPagination,
  type SuggestedFilterToken,
  type SuggestFnReturn,
  type SuggestionErrorContext,
  type SuggestionsConfig,
  type TokenLabelDisplay,
  type TokenState,
  type TokenType,
  type UnknownFieldsConfig,
  type ValidationAction,
  type ValidationConfig,
  type ValidationContext,
  type ValidationResult,
  type ValidationRule,
  type ValidationRuleFn,
  type ValidationToken,
  type ValueSuggestionListProps,
  type Violation,
  type ViolationTarget,
} from './types';

// ============================================
// Enum Value Utilities
// ============================================

export {
  defaultEnumResolver,
  enumResolvers,
  type FilterEnumValuesOptions,
  filterEnumValues,
  getEnumIcon,
  getEnumLabel,
  getEnumValue,
  isEnumValueWithLabel,
  type ResolveEnumValueOptions,
  resolveEnumValue,
} from './utils/enum-value';

// ============================================
// Label Resolve Utilities
// ============================================

export {
  defaultLabelResolver,
  labelResolvers,
  type ResolveLabelOptions,
  resolveLabel,
  resolveLabelToField,
} from './utils/label-resolve';

// ============================================
// Filter Items Utility
// ============================================

export { type FilterItemsOptions, filterItems } from './utils/filter-items';

// ============================================
// Matchers
// ============================================

export { defaultMatcher, matchBest, matchers } from './utils/matcher';

// ============================================
// Validation Presets
// ============================================

export {
  createFieldRule,
  createRule,
  type DuplicateGroup,
  type InvalidValueStrategy,
  MaxCount,
  type MaxCountOptions,
  type MaxCountStrategy,
  RequireEnum,
  type RequireEnumOptions,
  RequirePattern,
  type RequirePatternOptions,
  type StrategyResult,
  Unique,
  type UniqueConstraint,
  type UniqueOptions,
  type UniqueStrategy,
  ValidationRules,
} from './validation/presets';

// ============================================
// Validation Strategy Helpers
// ============================================

export {
  buildTargets,
  createDeleteViolation,
  createMarkViolation,
  type EditStatePartition,
  getNewOrEditingTokens,
  getUntouchedTokens,
  splitByEditState,
  type ViolationOptions,
} from './validation/strategy-helpers';

// ============================================
// Serialization (stable subset)
// ============================================

export {
  type CreateQuerySnapshotOptions,
  createQuerySnapshot,
  type ParseQueryOptions,
  parseQueryToDoc,
  type SerializeDocOptions,
  type SerializedToken,
  serializeDocToQuery,
} from './serializer';

// ============================================
// Query Snapshot Helpers
// ============================================

export {
  EMPTY_SNAPSHOT,
  getFilterTokens,
  getFreeTextTokens,
  getPlainText,
} from './utils/query-snapshot';

// ============================================
// Callback Types
// ============================================

export type { SerializeTokenFn } from './extensions/clipboard-serializer';
export type { DeserializeTextFn } from './extensions/editor-context';

// ============================================
// Token Attribute Utilities
// ============================================

export {
  CONFIG_ATTRS,
  CORE_ATTRS,
  type ConfigAttr,
  type CoreAttr,
  DISPLAY_ATTRS,
  type DisplayAttr,
  isDisplayOnlyChange,
  type UpdateTokenAttrsOptions,
  updateTokenAttrs,
  VALIDATION_ATTRS,
  type ValidationAttr,
} from './utils/token-attrs';

// ============================================
// Helpers (React-independent)
// ============================================

export {
  createToggleSelectHandler,
  type ToggleSelectOptions,
} from './helpers/toggle-select';
