import type { FieldDefinition, LabelResolver } from '../types';
import { resolveExactIdFirst } from './exact-id-first';

/**
 * Built-in resolvers for resolveLabel.
 */
export const labelResolvers = {
  /**
   * Case-insensitive exact match (default).
   * "Status" matches "status" or "STATUS".
   */
  caseInsensitive: ((ctx) => {
    const lowerQuery = ctx.query.toLowerCase();
    if (
      lowerQuery === ctx.field.key.toLowerCase() ||
      lowerQuery === ctx.field.label.toLowerCase()
    ) {
      return ctx.field.key;
    }
    return null;
  }) satisfies LabelResolver,

  /**
   * Case-sensitive exact match.
   * "status" matches only "status", not "Status".
   */
  exact: ((ctx) => {
    if (ctx.query === ctx.field.key || ctx.query === ctx.field.label) {
      return ctx.field.key;
    }
    return null;
  }) satisfies LabelResolver,
} as const;

/**
 * Default resolver (case-insensitive exact match).
 */
export const defaultLabelResolver = labelResolvers.caseInsensitive;

export interface ResolveLabelOptions {
  /**
   * Custom resolver function.
   * If provided, this function is called for each field, the field whose key equals
   * the input first.
   */
  resolver?: LabelResolver;
}

/**
 * Resolve input to field key.
 *
 * Input equal to a field's key is tried against that field first, so "author" resolves
 * to the key "author" even when an earlier field is labelled "Author"; otherwise fields
 * are tried in order. The resolver decides either way.
 *
 * Default behavior is case-insensitive exact match:
 * - "Status" → "status" (label match)
 * - "STATUS" → "status" (case-insensitive)
 * - "stat" → "stat" (no match, returns original)
 *
 * @returns Resolved field key or original input if no match
 *
 * @example
 * // Default: case-insensitive exact match
 * resolveLabel(fields, 'Status') // → 'status'
 *
 * // Case-sensitive exact match
 * import { labelResolvers } from '@kuruwic/tokenized-search-input/utils';
 * resolveLabel(fields, 'Status', { resolver: labelResolvers.exact })
 */
export function resolveLabel(
  fields: readonly FieldDefinition[],
  input: string,
  options?: ResolveLabelOptions
): string {
  return matchLabel(fields, input, options) ?? input;
}

/**
 * Resolve input and return the matching FieldDefinition if found.
 *
 * Unlike resolveLabel, input is never treated as a bare key: undefined when the
 * resolver matches no field.
 *
 * @returns Matching FieldDefinition or undefined if no match
 *
 * @example
 * const field = resolveLabelToField(fields, 'Status');
 * if (field) {
 *   console.log(field.key); // 'status'
 *   console.log(field.operators); // ['is', 'is_not']
 * }
 */
export function resolveLabelToField(
  fields: readonly FieldDefinition[],
  input: string,
  options?: ResolveLabelOptions
): FieldDefinition | undefined {
  const resolvedKey = matchLabel(fields, input, options);
  return resolvedKey === null ? undefined : fields.find((f) => f.key === resolvedKey);
}

function matchLabel(
  fields: readonly FieldDefinition[],
  input: string,
  options?: ResolveLabelOptions
): string | null {
  if (!input || !fields) return null;

  const resolver = options?.resolver ?? defaultLabelResolver;

  return resolveExactIdFirst(
    fields,
    input,
    (field) => field.key,
    (field) => resolver({ query: input, field: { key: field.key, label: field.label } })
  );
}
