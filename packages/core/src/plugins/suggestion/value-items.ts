import type { EnumValue, FieldDefinition } from '../../types';
import { filterEnumValues, getEnumLabel, getEnumValue } from '../../utils/enum-value';

/** The text the user edits for a value: a static enum value's label, otherwise the value itself. */
export function getEditableValueText(fieldDef: FieldDefinition | undefined, value: string): string {
  if (fieldDef?.type !== 'enum' || !fieldDef.enumValues) return value;
  const matched = fieldDef.enumValues.find((ev: EnumValue) => getEnumValue(ev) === value);
  return matched ? getEnumLabel(matched) : value;
}

/** The value suggestions for a token value: the enum values that match the text the user edits. */
export function matchValueSuggestions(
  fieldDef: FieldDefinition | undefined,
  value: string
): EnumValue[] {
  if (fieldDef?.type !== 'enum' || !fieldDef.enumValues) return [];
  return filterEnumValues(fieldDef.enumValues, getEditableValueText(fieldDef, value), {
    matcher: fieldDef.suggestionMatcher,
  });
}
