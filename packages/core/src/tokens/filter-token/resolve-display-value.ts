import { parseDateFieldValue } from '../../pickers/date-format';
import type { DateTimeValue } from '../../pickers/date-time-value';
import type { TokenDisplayContent } from '../../plugins/shared/meta';
import type {
  DateFormatConfig,
  DateTimeFormatConfig,
  EnumValue,
  FieldDefinition,
} from '../../types';
import { getEnumIcon, getEnumLabel, getEnumValue } from '../../utils/enum-value';

export interface ResolveDisplayValueInput {
  rawValue: string;
  fieldDef: FieldDefinition | undefined;
  /** Display data that describes the token's current value, if any */
  display: TokenDisplayContent | undefined;
  /** Date display formatter (injected for testability) */
  getDateDisplayValue?: (value: DateTimeValue, config?: DateFormatConfig) => string;
  /** DateTime display formatter (injected for testability) */
  getDateTimeDisplayValue?: (value: DateTimeValue, config?: DateTimeFormatConfig) => string;
}

export interface ResolveDisplayValueResult {
  valueDisplayString: string;
  startContent: React.ReactNode | undefined;
  endContent: React.ReactNode | undefined;
}

/**
 * The text of a date or datetime token, or `null` when the field is not a date field or
 * no formatter was given. A value that is not a valid date is shown as typed.
 */
function dateText(input: ResolveDisplayValueInput): string | null {
  const { rawValue, fieldDef, getDateDisplayValue, getDateTimeDisplayValue } = input;
  if (fieldDef?.type === 'date' && getDateDisplayValue) {
    const parsed = parseDateFieldValue(rawValue, fieldDef);
    return parsed.ok ? getDateDisplayValue(parsed.value, fieldDef.formatConfig) : rawValue;
  }
  if (fieldDef?.type === 'datetime' && getDateTimeDisplayValue) {
    const parsed = parseDateFieldValue(rawValue, fieldDef);
    return parsed.ok ? getDateTimeDisplayValue(parsed.value, fieldDef.formatConfig) : rawValue;
  }
  return null;
}

/**
 * Priority: token display data > enumValues > date/datetime formatting > raw value
 */
export function resolveDisplayValue(input: ResolveDisplayValueInput): ResolveDisplayValueResult {
  const { rawValue, fieldDef, display } = input;

  // 1. Display data takes precedence (custom suggestions, async resolvers). For
  // date/datetime it still adds custom startContent/endContent to the formatted text.
  if (display && (display.displayValue || display.startContent || display.endContent)) {
    return {
      valueDisplayString: display.displayValue ?? dateText(input) ?? rawValue,
      startContent: display.startContent ?? undefined,
      endContent: display.endContent ?? undefined,
    };
  }

  // 2. enumValues lookup (for enum fields with static configuration)
  if (fieldDef?.type === 'enum') {
    if (fieldDef.enumValues && fieldDef.enumValues.length > 0) {
      const matched = fieldDef.enumValues.find((ev: EnumValue) => getEnumValue(ev) === rawValue);
      if (matched) {
        return {
          valueDisplayString: getEnumLabel(matched),
          startContent: getEnumIcon(matched),
          endContent: undefined,
        };
      }
    }
    return { valueDisplayString: rawValue, startContent: undefined, endContent: undefined };
  }

  // 3. date/datetime formatting
  const formatted = dateText(input);
  if (formatted !== null) {
    return { valueDisplayString: formatted, startContent: undefined, endContent: undefined };
  }

  // 4. Fallback to raw value
  return { valueDisplayString: rawValue, startContent: undefined, endContent: undefined };
}
