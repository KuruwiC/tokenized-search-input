import type { FieldDefinition } from '../types';
import { resolveStoredValue } from '../utils/enum-value';
import { unquote } from '../utils/quoted-string';

/** The value a token of `field` stores for the text written after its operator. */
export function resolveTokenValue(field: FieldDefinition | null | undefined, raw: string): string {
  return resolveStoredValue(field, unquote(raw).value);
}
