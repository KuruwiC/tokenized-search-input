import type { FieldDefinition } from '../../types';
import { generateTokenId } from '../../utils/token-id';

export interface CreateFilterTokenAttrsInput {
  /** Field key (required) */
  key: string;
  /** Operator (required) */
  operator: string;
  /** Value (optional) */
  value?: string;
  /** Field definitions to lookup field metadata */
  fields: FieldDefinition[];
  /** Explicit token ID (if not provided, a new UUID will be generated) */
  id?: string;
  /** Display overrides (for custom suggestions) */
  overrides?: {
    fieldLabel?: string;
    displayValue?: string;
    startContent?: React.ReactNode;
    endContent?: React.ReactNode;
  };
}

export interface NodeFilterTokenAttrs {
  id: string;
  key: string;
  operator: string;
  value: string;
  fieldLabel: string;
  invalid: boolean;
  immutable: boolean;
  confirmed: boolean;
  displayValue: string | null;
  startContent: React.ReactNode | null;
  endContent: React.ReactNode | null;
  [key: string]: unknown;
}

/**
 * Creates filter token attributes from input parameters.
 * All token creation paths should use this function to ensure consistent attributes.
 *
 * @param input - Token creation parameters
 * @returns Complete filter token attributes including a stable UUID
 */
export function createFilterTokenAttrs(input: CreateFilterTokenAttrsInput): NodeFilterTokenAttrs {
  const { key, operator, value = '', fields, id, overrides } = input;
  const fieldDef = fields.find((f) => f.key === key);

  // Tokens with value are considered confirmed (e.g., from deserialization)
  const hasValue = !!value;
  const isConfirmed = hasValue;
  const isImmutable = (fieldDef?.immutable ?? false) && hasValue;

  return {
    id: id ?? generateTokenId(),
    key,
    operator,
    value,
    fieldLabel: overrides?.fieldLabel ?? fieldDef?.label ?? key,
    invalid: false,
    immutable: isImmutable,
    confirmed: isConfirmed,
    displayValue: overrides?.displayValue ?? null,
    startContent: overrides?.startContent ?? null,
    endContent: overrides?.endContent ?? null,
  };
}
