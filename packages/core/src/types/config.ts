import type { ReactNode } from 'react';

import type { DeserializeTextFn } from '../extensions/editor-context';
import type {
  CustomSuggestionConfig,
  DatePickerRenderProps,
  DateTimePickerRenderProps,
  Matcher,
  OperatorLabels,
  PaginationLabels,
} from './index';
import type { FilterTokenAttrs } from './tokens';

/**
 * Configuration for field name suggestions.
 */
interface FieldSuggestionsConfig {
  /** Disable field name autocomplete. @default false */
  disabled?: boolean;
  /** Matcher for field suggestions. @default matchers.fuzzy */
  matcher?: Matcher;
}

/**
 * Configuration for value suggestions.
 */
interface ValueSuggestionsConfig {
  /** Disable value autocomplete for enum fields. @default false */
  disabled?: boolean;
}

/**
 * Configuration for suggestions behavior.
 */
export interface SuggestionsConfig {
  /** Field name suggestion settings */
  field?: FieldSuggestionsConfig;
  /** Value suggestion settings */
  value?: ValueSuggestionsConfig;
  /** Custom suggestion configuration */
  custom?: CustomSuggestionConfig;
}

/**
 * Configuration for clipboard serialization behavior.
 */
export interface SerializationConfig {
  /**
   * Custom token serializer for clipboard copy.
   * Return null to use default format.
   */
  serializeToken?: (token: FilterTokenAttrs) => string | null;
  /**
   * Custom text deserializer for paste.
   * Return null to fallback to default parser.
   */
  deserializeText?: DeserializeTextFn;
}

/**
 * Configuration for label customization (i18n).
 */
export interface LabelsConfig {
  /** Operator display labels (i18n) */
  operators?: OperatorLabels;
  /** Pagination UI labels (i18n) */
  pagination?: PaginationLabels;
}

/**
 * Configuration for custom date/datetime pickers.
 */
export interface PickersConfig {
  /** Custom date picker renderer */
  renderDate?: (props: DatePickerRenderProps) => ReactNode;
  /** Custom datetime picker renderer */
  renderDateTime?: (props: DateTimePickerRenderProps) => ReactNode;
}

/**
 * All stylable slots in the component.
 */
export type ClassNameSlot =
  // Root-level
  | 'root'
  | 'input'
  | 'placeholder'
  | 'clearButton'
  | 'startAdornment'
  | 'endAdornment'
  // Token
  | 'token'
  | 'tokenLabel'
  | 'tokenOperator'
  | 'tokenValue'
  | 'tokenDeleteButton'
  // Suggestions
  | 'dropdown'
  | 'operatorDropdown'
  | 'operatorDropdownItem'
  | 'suggestionItem'
  | 'suggestionItemHint'
  | 'suggestionItemDescription'
  | 'suggestionItemIcon'
  | 'fieldCategory'
  | 'divider';

/**
 * Custom class names for styling component parts.
 */
export type ClassNames = Partial<Record<ClassNameSlot, string>>;
