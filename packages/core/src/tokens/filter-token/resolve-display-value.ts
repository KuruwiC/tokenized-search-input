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
  nodeAttrs: {
    displayValue?: string | null;
    startContent?: React.ReactNode | null;
    endContent?: React.ReactNode | null;
  };
  /** Date display formatter (injected for testability) */
  getDateDisplayValue?: (value: string, config?: DateFormatConfig) => string;
  /** DateTime display formatter (injected for testability) */
  getDateTimeDisplayValue?: (value: string, config?: DateTimeFormatConfig) => string;
}

export interface ResolveDisplayValueResult {
  valueDisplayString: string;
  startContent: React.ReactNode | undefined;
  endContent: React.ReactNode | undefined;
}

/**
 * Priority: node.attrs > enumValues > date/datetime formatting > raw value
 */
export function resolveDisplayValue(input: ResolveDisplayValueInput): ResolveDisplayValueResult {
  const { rawValue, fieldDef, nodeAttrs, getDateDisplayValue, getDateTimeDisplayValue } = input;

  const isEnumField = fieldDef?.type === 'enum';
  const isDateField = fieldDef?.type === 'date';
  const isDateTimeField = fieldDef?.type === 'datetime';

  // 1. node.attrs take precedence (for custom suggestions with displayValue/startContent/endContent)
  if (nodeAttrs.displayValue || nodeAttrs.startContent || nodeAttrs.endContent) {
    // For date/datetime, use formatted display but allow custom startContent/endContent
    if (isDateField && fieldDef?.type === 'date' && getDateDisplayValue) {
      const dateDisplay =
        nodeAttrs.displayValue ?? getDateDisplayValue(rawValue, fieldDef.formatConfig);
      return {
        valueDisplayString: dateDisplay,
        startContent: nodeAttrs.startContent ?? undefined,
        endContent: nodeAttrs.endContent ?? undefined,
      };
    }
    if (isDateTimeField && fieldDef?.type === 'datetime' && getDateTimeDisplayValue) {
      const dateTimeDisplay =
        nodeAttrs.displayValue ?? getDateTimeDisplayValue(rawValue, fieldDef.formatConfig);
      return {
        valueDisplayString: dateTimeDisplay,
        startContent: nodeAttrs.startContent ?? undefined,
        endContent: nodeAttrs.endContent ?? undefined,
      };
    }
    return {
      valueDisplayString: nodeAttrs.displayValue ?? rawValue,
      startContent: nodeAttrs.startContent ?? undefined,
      endContent: nodeAttrs.endContent ?? undefined,
    };
  }

  // 2. enumValues lookup (for enum fields with static configuration)
  if (isEnumField && fieldDef?.type === 'enum') {
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
  if (isDateField && fieldDef?.type === 'date' && getDateDisplayValue) {
    const dateDisplay = getDateDisplayValue(rawValue, fieldDef.formatConfig);
    return {
      valueDisplayString: dateDisplay,
      startContent: undefined,
      endContent: undefined,
    };
  }
  if (isDateTimeField && fieldDef?.type === 'datetime' && getDateTimeDisplayValue) {
    const dateTimeDisplay = getDateTimeDisplayValue(rawValue, fieldDef.formatConfig);
    return {
      valueDisplayString: dateTimeDisplay,
      startContent: undefined,
      endContent: undefined,
    };
  }

  // 4. Fallback to raw value
  return { valueDisplayString: rawValue, startContent: undefined, endContent: undefined };
}
