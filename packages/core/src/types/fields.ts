import type { ReactNode } from 'react';
import type { DefaultOperator, OperatorLabels } from './operators';
import type { FieldRuleOverride } from './validation';

/**
 * An array type that requires at least one element.
 * Use this to enforce non-empty arrays at compile time.
 *
 * @example
 * const valid: AtLeastOne<string> = ['a', 'b']; // OK
 * const invalid: AtLeastOne<string> = []; // Type error
 *
 * // For dynamic arrays from API:
 * if (apiData.length === 0) throw new Error('Array must not be empty');
 * const nonEmpty = apiData as AtLeastOne<string>;
 */
export type AtLeastOne<T> = readonly [T, ...T[]];

export interface EnumValueWithLabel {
  value: string;
  label: string;
  /**
   * Icon to display before the label.
   * Not persisted across Undo/Redo with dynamic enumValues.
   * @see SuggestedFilterToken.startContent
   */
  icon?: ReactNode;
}

export type EnumValue = string | EnumValueWithLabel;

export type FieldType = 'string' | 'date' | 'datetime' | 'enum';

/**
 * Token label display mode.
 * - 'auto': Show icon (if any) + text label (default)
 * - 'icon-only': Show icon only. IMPORTANT: If no icon is set, falls back to showing
 *   text label to prevent blank tokens.
 * - 'hidden': Hide entire label block
 */
export type TokenLabelDisplay = 'auto' | 'icon-only' | 'hidden';

interface BaseFieldDefinition {
  key: string;
  label: string;
  category?: string;
  /**
   * Operators available for this field.
   * At least one operator is required.
   * Use DefaultOperator for built-in operators with autocompletion.
   * Custom operators (string) are also supported.
   */
  operators: AtLeastOne<DefaultOperator | (string & {})>;
  allowSpaces?: boolean;
  validate?: (value: string) => boolean | string;
  sanitize?: (value: string) => string;
  getValues?: (query: string) => Promise<string[]>;
  icon?: ReactNode;
  hint?: ReactNode;
  operatorLabels?: OperatorLabels;
  /**
   * Token label display mode.
   * - 'auto': Show icon (if any) + text label (default)
   * - 'icon-only': Show icon only (requires icon, falls back to label if no icon)
   * - 'hidden': Hide entire label block
   */
  tokenLabelDisplay?: TokenLabelDisplay;
  /**
   * Hide the operator display when there is only a single operator.
   * This option is ignored when multiple operators are available
   * (operator must remain visible for user interaction).
   * @default false
   */
  hideSingleOperator?: boolean;
  /**
   * Make tokens immutable (only deletable via X button or 2-stage Backspace).
   *
   * When true, typing "fieldKey:" does NOT create an empty token immediately.
   * Instead, the text is converted to a token only on explicit triggers:
   * Space, Enter, Tab, or paste. This prevents creating empty immutable tokens
   * that cannot be edited.
   *
   * @default false
   */
  immutable?: boolean;
  /**
   * Per-rule overrides for this field.
   * @example
   * validation: {
   *   'unique-key': false,  // Disable uniqueness for this field
   * }
   */
  validation?: Record<string, FieldRuleOverride>;
}

/**
 * Generic matcher function that returns a match score for a single target.
 *
 * Score values:
 * - 0: No match
 * - 1-99: Partial match (higher = better)
 * - 100: Exact match
 *
 * When multiple items have the same score, array order takes precedence.
 *
 * @example
 * // Custom matcher
 * const myMatcher: Matcher = (input, target) => {
 *   if (input === target) return 100;
 *   if (target.toLowerCase().includes(input.toLowerCase())) return 50;
 *   return 0;
 * };
 *
 * // Using built-in matchers
 * import { matchers } from 'search-input';
 * const field = { suggestionMatcher: matchers.fuzzy };
 */
export type Matcher = (input: string, target: string) => number;

/**
 * Context provided to enum value resolver functions.
 */
export interface EnumResolverContext {
  /** User input to match against */
  query: string;
  /** The enum option being tested */
  option: {
    value: string;
    label: string;
  };
}

/**
 * Resolver function for converting user input to internal enum value.
 * Returns the resolved value if matched, or null to continue searching.
 *
 * @example
 * // Custom resolver: match by first character only
 * const myResolver: EnumValueResolver = (ctx) => {
 *   if (ctx.query[0]?.toLowerCase() === ctx.option.value[0]?.toLowerCase()) {
 *     return ctx.option.value;
 *   }
 *   return null;
 * };
 *
 * // Using built-in resolvers
 * import { enumResolvers } from 'search-input';
 * const field = { valueResolver: enumResolvers.exact };
 */
export type EnumValueResolver = (ctx: EnumResolverContext) => string | null;

/**
 * Context provided to label resolver functions.
 */
export interface LabelResolverContext {
  /** User input to match against */
  query: string;
  /** The field being tested */
  field: {
    key: string;
    label: string;
  };
}

/**
 * Resolver function for converting user input to field key.
 * Returns the resolved key if matched, or null to continue searching.
 *
 * @example
 * // Custom resolver: match by key prefix
 * const myResolver: LabelResolver = (ctx) => {
 *   if (ctx.field.key.startsWith(ctx.query.toLowerCase())) {
 *     return ctx.field.key;
 *   }
 *   return null;
 * };
 *
 * // Using built-in resolvers
 * import { labelResolvers } from 'search-input';
 * const config = { labelResolver: labelResolvers.exact };
 */
export type LabelResolver = (ctx: LabelResolverContext) => string | null;

export interface EnumFieldDefinition extends BaseFieldDefinition {
  type: 'enum';
  /**
   * Enum values for the field.
   *
   * Optional when using custom suggestions with `displayMode: 'replace'`,
   * since the custom suggestion provides all display information via
   * `displayValue`, `startContent`, and `endContent`.
   *
   * Required for static enum fields that rely on built-in value suggestions.
   */
  enumValues?: AtLeastOne<EnumValue>;
  /**
   * Matcher function for filtering suggestions while user types.
   * Use built-in matchers from `matchers` or provide a custom function.
   * @default matchers.fuzzy
   */
  suggestionMatcher?: Matcher;
  /**
   * Resolver function for converting user input to internal enum value.
   * Use built-in resolvers from `enumResolvers` or provide a custom function.
   * @default enumResolvers.caseInsensitive
   */
  valueResolver?: EnumValueResolver;
}

export interface DateFormatConfig {
  /**
   * Converts user input to ISO 8601 string for internal storage.
   * Use this to support custom input formats (e.g., "Jan 15", "2024/1/15", Unix timestamps).
   *
   * @param input - Raw user input string
   * @returns ISO 8601 string (e.g., "2024-01-15") or null if invalid
   *
   * @example
   * // Support Unix timestamp input
   * parse: (input) => {
   *   const ts = Number(input);
   *   if (!isNaN(ts)) return new Date(ts).toISOString();
   *   return null;
   * }
   */
  parse?: (input: string) => string | null;

  /**
   * Converts ISO 8601 string to display string for UI.
   *
   * @param isoValue - ISO 8601 string from internal storage
   * @returns Human-readable display string
   *
   * @example
   * // Display as "January 15, 2024"
   * format: (iso) => {
   *   const date = parseISO(iso);
   *   return format(date, 'MMMM d, yyyy');
   * }
   */
  format?: (isoValue: string) => string;
}

export interface DateTimeFormatConfig extends DateFormatConfig {
  // Inherits parse/format from DateFormatConfig
}

export interface DateFieldDefinition extends BaseFieldDefinition {
  type: 'date';
  formatConfig?: DateFormatConfig;
  minDate?: Date | string;
  maxDate?: Date | string;
  disabledDates?: (date: Date) => boolean;
  renderPicker?: (props: DatePickerRenderProps) => ReactNode;
  /** Label for the close button. Defaults to a check icon. */
  closeButtonLabel?: ReactNode;
}

export interface DateTimeFieldDefinition extends BaseFieldDefinition {
  type: 'datetime';
  formatConfig?: DateTimeFormatConfig;
  timeOptions?: {
    hour24?: boolean;
  };
  minDate?: Date | string;
  maxDate?: Date | string;
  disabledDates?: (date: Date) => boolean;
  renderPicker?: (props: DateTimePickerRenderProps) => ReactNode;
  /** Label for the close button. Defaults to a check icon. */
  closeButtonLabel?: ReactNode;
  /**
   * Whether time component is required for this datetime field.
   * - false (default): Time is optional. Users can select date-only or date+time.
   * - true: Time is required. Date-only values are normalized to datetime format.
   * @default false
   */
  timeRequired?: boolean;
}

export interface SimpleFieldDefinition extends BaseFieldDefinition {
  type: 'string';
}

export type FieldDefinition =
  | EnumFieldDefinition
  | DateFieldDefinition
  | DateTimeFieldDefinition
  | SimpleFieldDefinition;

export interface BaseDatePickerRenderProps<
  T extends DateFieldDefinition | DateTimeFieldDefinition,
> {
  /**
   * Date/DateTime to display. Reflects keyboard input in realtime, falls back to last valid value.
   * Use this as the single source of truth for what to show in the picker.
   */
  value: Date | null;

  /**
   * Called when user selects a date/time. Pass null to clear.
   */
  onChange: (date: Date | null) => void;

  /**
   * Called when user wants to close the picker (e.g., clicking close button).
   */
  onClose: () => void;

  /**
   * Field configuration including minDate, maxDate, disabledDates, locale, etc.
   */
  fieldDef: T;

  /**
   * Restore focus to token input and scroll it into view after date selection.
   */
  restoreFocus?: () => void;

  /**
   * Initial calendar month hint. Picker can manage its own navigation state after mount.
   */
  defaultMonth?: Date;

  /**
   * Last confirmed/committed value (before current input changes).
   * Useful for pickers that need to distinguish between preview and committed states.
   */
  confirmedValue?: Date | null;
}

/**
 * Props for custom date picker renderers.
 */
export interface DatePickerRenderProps extends BaseDatePickerRenderProps<DateFieldDefinition> {}

/**
 * Time zone controls for datetime pickers.
 */
export interface DateTimeTimeControls {
  /** Current UTC mode state */
  isUTC: boolean;
  /** Toggle UTC mode */
  onUTCChange: (isUTC: boolean) => void;
  /** Current include time state (only when timeRequired is false) */
  includeTime: boolean;
  /** Toggle include time */
  onIncludeTimeChange: (includeTime: boolean) => void;
}

/**
 * Props for custom datetime picker renderers.
 */
export interface DateTimePickerRenderProps
  extends BaseDatePickerRenderProps<DateTimeFieldDefinition> {
  /** Time zone controls for UTC mode toggle */
  timeControls: DateTimeTimeControls;
}
