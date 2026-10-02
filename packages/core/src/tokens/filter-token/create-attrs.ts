import { resolveStoredValue } from '../../utils/enum-value';
import { type FieldResolutionSource, resolveField } from '../../utils/resolve-field';
import { generateTokenId } from '../../utils/token-id';

export interface CreateFilterTokenAttrsInput {
  /** Field key (required) */
  key: string;
  /** Operator (required) */
  operator: string;
  /** Value (optional) */
  value?: string;
  /** Decides which field the key refers to */
  source: FieldResolutionSource;
  /** Explicit token ID (if not provided, a new UUID will be generated) */
  id?: string;
}

export interface NodeFilterTokenAttrs {
  id: string;
  key: string;
  operator: string;
  value: string;
  immutable: boolean;
  [key: string]: unknown;
}

/**
 * Creates filter token attributes from input parameters.
 * All token creation paths should use this function to ensure consistent attributes,
 * including the value an enum token stores.
 *
 * @param input - Token creation parameters
 * @returns Complete filter token attributes including a stable UUID
 */
export function createFilterTokenAttrs(input: CreateFilterTokenAttrsInput): NodeFilterTokenAttrs {
  const { key, operator, source, id } = input;
  const fieldDef = resolveField(source, key);
  const value = resolveStoredValue(fieldDef, input.value ?? '');

  return {
    id: id ?? generateTokenId(),
    key,
    operator,
    value,
    immutable: (fieldDef?.immutable ?? false) && !!value,
  };
}
