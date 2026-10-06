import type { ReactNode } from 'react';

import type {
  EnumValue,
  EnumValueResolver,
  EnumValueWithLabel,
  FieldDefinition,
  Matcher,
} from '../types';
import { type FilterItemsOptions, filterItems } from './filter-items';

/**
 * Type guard to check if an EnumValue is an object with label.
 */
export function isEnumValueWithLabel(item: EnumValue): item is EnumValueWithLabel {
  return typeof item !== 'string';
}

/**
 * Get the internal value from an EnumValue.
 */
export function getEnumValue(item: EnumValue): string {
  return isEnumValueWithLabel(item) ? item.value : item;
}

/**
 * Get the label (display value) from an EnumValue.
 */
export function getEnumLabel(item: EnumValue): string {
  return isEnumValueWithLabel(item) ? item.label : item;
}

/**
 * Get the icon from an EnumValue (if available).
 */
export function getEnumIcon(item: EnumValue): ReactNode | undefined {
  return isEnumValueWithLabel(item) ? item.icon : undefined;
}

export interface FilterEnumValuesOptions {
  /**
   * Matcher for filtering suggestions.
   * @default matchers.fuzzy
   */
  matcher?: Matcher;
  /**
   * Lowest matcher score, on its 0..1 scale, a value may have and still be included.
   * @default 0
   */
  minScore?: number;
}

/**
 * Filter enum values by query string using the specified matcher.
 * Results are sorted by match score (highest first).
 *
 * This is a convenience wrapper around filterItems for enum values.
 */
export function filterEnumValues(
  enumValues: readonly EnumValue[] | undefined,
  query: string,
  options?: FilterEnumValuesOptions
): EnumValue[] {
  if (!enumValues || enumValues.length === 0) return [];

  const filterOptions: FilterItemsOptions = {
    matcher: options?.matcher,
    minScore: options?.minScore,
  };

  return filterItems(
    enumValues,
    query,
    (ev) => [getEnumValue(ev), getEnumLabel(ev)],
    filterOptions
  );
}

export interface ResolveEnumValueOptions {
  /**
   * Custom resolver function.
   * If provided, this function is called for each enum value, except when the input
   * equals an option's value (that option wins without it).
   * Return the resolved value string to use it, or null to skip.
   */
  resolver?: EnumValueResolver;
}

/**
 * Built-in resolvers for resolveEnumValue.
 */
export const enumResolvers = {
  /**
   * Case-insensitive exact match (default).
   * "ACTIVE" matches "active" or "Active".
   */
  caseInsensitive: ((ctx) => {
    const lowerQuery = ctx.query.toLowerCase();
    if (
      lowerQuery === ctx.option.value.toLowerCase() ||
      lowerQuery === ctx.option.label.toLowerCase()
    ) {
      return ctx.option.value;
    }
    return null;
  }) satisfies EnumValueResolver,

  /**
   * Case-sensitive exact match.
   * "active" matches only "active", not "Active".
   */
  exact: ((ctx) => {
    if (ctx.query === ctx.option.value || ctx.query === ctx.option.label) {
      return ctx.option.value;
    }
    return null;
  }) satisfies EnumValueResolver,
} as const;

/**
 * Default resolver (case-insensitive exact match).
 */
export const defaultEnumResolver = enumResolvers.caseInsensitive;

/**
 * Resolve input to internal enum value.
 *
 * Input equal to an option's value resolves to that option, whatever the resolver
 * and whatever label an earlier option has, so a stored value always reads back as
 * itself. Otherwise the resolver is tried on each option in order and the first
 * non-null result wins; input no option matches is returned as written.
 *
 * Default behavior is case-insensitive exact match (lookup, not fuzzy):
 * - "Active" → "active" (label match)
 * - "ACTIVE" → "active" (case-insensitive)
 * - "act" → "act" (no match, returns original)
 *
 * Use filterEnumValues() for suggestion filtering.
 *
 * @example
 * // Default: case-insensitive exact match
 * resolveEnumValue(enumValues, 'Active') // → 'active'
 *
 * // Case-sensitive exact match
 * import { enumResolvers } from '@kuruwic/tokenized-search-input/utils';
 * resolveEnumValue(enumValues, 'Active', { resolver: enumResolvers.exact })
 */
export function resolveEnumValue(
  enumValues: readonly EnumValue[],
  input: string,
  options?: ResolveEnumValueOptions
): string {
  if (!input) return input;
  if (!enumValues || enumValues.length === 0) return input;

  if (enumValues.some((ev) => getEnumValue(ev) === input)) return input;

  const resolver = options?.resolver ?? defaultEnumResolver;

  for (const ev of enumValues) {
    const value = getEnumValue(ev);
    const label = getEnumLabel(ev);
    const resolved = resolver({
      query: input,
      option: { value, label },
    });
    if (resolved !== null) {
      return resolved;
    }
  }

  return input;
}

/**
 * The value a token of `field` stores for `value`. An enum token holds the value of
 * the option the text names, by value, by label or in another case; a value equal to an
 * option's value always names that option. A value that names no option, and any value of
 * a field without static options, is stored as written.
 */
export function resolveStoredValue(
  field: FieldDefinition | null | undefined,
  value: string
): string {
  return field?.type === 'enum' && field.enumValues
    ? resolveEnumValue(field.enumValues, value, { resolver: field.valueResolver })
    : value;
}
