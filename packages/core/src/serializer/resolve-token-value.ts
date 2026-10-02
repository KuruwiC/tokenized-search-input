import type { FieldDefinition } from '../types';
import { resolveStoredValue } from '../utils/enum-value';
import { unquote } from '../utils/quoted-string';

/**
 * The value a token of `field` holds for the text written after its operator: the value
 * of the quotes when the text is quoted, and for an enum field the value of the option
 * the text names, as the editor stores it everywhere else.
 */
export function resolveTokenValue(field: FieldDefinition | null | undefined, raw: string): string {
  return resolveStoredValue(field, unquote(raw).value);
}
