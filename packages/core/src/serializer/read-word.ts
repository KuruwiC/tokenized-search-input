import { DEFAULT_OPERATORS } from '../types';
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

function isKnownOperator(name: string, source: FieldResolutionSource): boolean {
  const named: readonly string[] = source.unknownFields?.operators ?? [];
  return (DEFAULT_OPERATORS as readonly string[]).includes(name) || named.includes(name);
}

/** Keys that look like a name of a field; `http`, `a.b` and `user_id` do, `10` and `.x` do not. */
const IDENTIFIER_KEY = /^[A-Za-z_][\w.-]*$/;

/**
 * Reads a word that holds a delimiter: its `key` and what follows it. A word after the key
 * that the field allows is the operator. One that a default operator or the `unknownFields`
 * template names, and the field does not allow, is read as the operator too and marked
 * unknown, so the input stays what it was written. Anything else is part of the value, and
 * the operator is the first one of the field. A word with an empty key is never a filter.
 */
export function readWord(
  word: { key: string; rest: string },
  source: FieldResolutionSource,
  delimiter: string
): WordReading | null {
  if (!word.key) return null;
  const field = resolveField(source, word.key);
  if (!field) {
    return IDENTIFIER_KEY.test(word.key) ? { type: 'unknownField', key: word.key } : null;
  }

  const separator = word.rest.indexOf(delimiter);
  const candidate = separator < 0 ? undefined : word.rest.slice(0, separator);
  if (candidate !== undefined) {
    const allowed = (field.operators as readonly string[]).includes(candidate);
    if (allowed || isKnownOperator(candidate, source)) {
      return {
        type: 'filter',
        key: word.key,
        operator: candidate,
        value: resolveTokenValue(field, word.rest.slice(separator + 1)),
        unknownOperator: !allowed,
      };
    }
  }
  return {
    type: 'filter',
    key: word.key,
    operator: field.operators[0],
    value: resolveTokenValue(field, word.rest),
    unknownOperator: false,
  };
}
