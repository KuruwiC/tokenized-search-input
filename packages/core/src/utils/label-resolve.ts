import type { FieldDefinition, LabelResolver } from '../types';

export type { LabelResolver } from '../types';

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
   * If provided, this function is called for each field.
   */
  resolver?: LabelResolver;
}

/**
 * Resolve input to field key.
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
 * import { labelResolvers } from 'search-input';
 * resolveLabel(fields, 'Status', { resolver: labelResolvers.exact })
 */
export function resolveLabel(
  fields: readonly FieldDefinition[],
  input: string,
  options?: ResolveLabelOptions
): string {
  if (!input) return input;
  if (!fields || fields.length === 0) return input;

  const resolver = options?.resolver ?? defaultLabelResolver;

  for (const field of fields) {
    const resolved = resolver({
      query: input,
      field: { key: field.key, label: field.label },
    });
    if (resolved !== null) {
      return resolved;
    }
  }

  return input;
}

/**
 * Resolve input and return the matching FieldDefinition if found.
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
  const resolvedKey = resolveLabel(fields, input, options);
  return fields.find((f) => f.key === resolvedKey);
}
