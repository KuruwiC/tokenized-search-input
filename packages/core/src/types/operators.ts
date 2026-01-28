/**
 * Default operators provided by the library.
 * Users can extend this with custom operators using the generic type parameter.
 */
export const DEFAULT_OPERATORS = [
  'is',
  'is_not',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'gt',
  'lt',
  'gte',
  'lte',
] as const;

/**
 * Default operator type derived from DEFAULT_OPERATORS.
 * Use this type directly or extend it with custom operators.
 *
 * @example
 * // Using default operators only
 * type MyOperator = DefaultOperator;
 *
 * // Extending with custom operators
 * type CustomOperator = DefaultOperator | 'between' | 'in' | 'regex';
 */
export type DefaultOperator = (typeof DEFAULT_OPERATORS)[number];

/** All valid default operators */
export const ALL_OPERATORS: readonly DefaultOperator[] = DEFAULT_OPERATORS;

/** Default labels for operators */
export const DEFAULT_OPERATOR_LABELS: Record<DefaultOperator, string> = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  not_contains: 'not contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
};

/**
 * Operator label configuration.
 * Can be a string (same label everywhere) or an object with different labels
 * for token display vs dropdown selection.
 */
export type OperatorLabelConfig = string | { display: string; select: string };

/**
 * Operator labels mapping.
 * Maps operator strings to their display labels.
 *
 * @example
 * const labels: OperatorLabels = { is: '=', is_not: '≠', between: '↔' };
 */
export type OperatorLabels = Partial<Record<string, OperatorLabelConfig>>;

export function getOperatorDisplayLabel(labels: OperatorLabels, operator: string): string {
  const config = labels[operator];
  if (!config) return operator;
  return typeof config === 'string' ? config : config.display;
}

export function getOperatorSelectLabel(labels: OperatorLabels, operator: string): string {
  const config = labels[operator];
  if (!config) return operator;
  return typeof config === 'string' ? config : config.select;
}
