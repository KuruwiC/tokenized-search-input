import { DEFAULT_OPERATORS, type FieldDefinition, type UnknownFieldTemplate } from '../types';
import { type FieldResolutionSource, resolveField } from '../utils/resolve-field';
import { resolveTokenValue } from './resolve-token-value';

/** What a word of a query stands for, before the value is checked to be there. */
export type WordReading =
  | {
      type: 'filter';
      key: string;
      operator: string;
      value: string;
      /** The operator is one the editor knows, but the field of the key does not allow it. */
      unknownOperator: boolean;
    }
  /** The word starts as a key and a delimiter, and no field is defined for the key. */
  | { type: 'unknownField'; key: string };

/**
 * The names the editor knows as operators: the defaults and every operator a field or
 * the unknown field template declares. A word after the key that is none of them is part
 * of the value, so a value such as `10:30` needs no operator.
 */
export function knownOperators(
  fields: readonly FieldDefinition[],
  unknownFields: UnknownFieldTemplate | undefined
): ReadonlySet<string> {
  const names = new Set<string>(DEFAULT_OPERATORS);
  for (const field of fields) for (const operator of field.operators) names.add(operator);
  for (const operator of unknownFields?.operators ?? []) names.add(operator);
  return names;
}

/**
 * Reads a word that holds a delimiter: its `key` and what follows it. A word after the key
 * that the field allows is the operator; one the editor knows but the field does not allow
 * is read as the operator too and marked unknown, so the input stays what it was written;
 * anything else is part of the value, and the operator is the first one of the field.
 */
export function readWord(
  word: { key: string; rest: string },
  source: FieldResolutionSource,
  delimiter: string,
  known: ReadonlySet<string>
): WordReading | null {
  const field = resolveField(source, word.key);
  if (!field) return word.key ? { type: 'unknownField', key: word.key } : null;

  const separator = word.rest.indexOf(delimiter);
  const candidate = separator < 0 ? undefined : word.rest.slice(0, separator);
  if (candidate !== undefined && known.has(candidate)) {
    return {
      type: 'filter',
      key: word.key,
      operator: candidate,
      value: resolveTokenValue(field, word.rest.slice(separator + 1)),
      unknownOperator: !(field.operators as readonly string[]).includes(candidate),
    };
  }
  return {
    type: 'filter',
    key: word.key,
    operator: field.operators[0],
    value: resolveTokenValue(field, word.rest),
    unknownOperator: false,
  };
}
