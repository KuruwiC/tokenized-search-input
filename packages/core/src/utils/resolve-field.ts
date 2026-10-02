import {
  DEFAULT_OPERATORS,
  type FieldDefinition,
  type SimpleFieldDefinition,
  type UnknownFieldTemplate,
} from '../types';

/** The part of the editor context that decides which field a key refers to. */
export interface FieldResolutionSource {
  fields: readonly FieldDefinition[];
  /** Presence allows unknown keys; the template shapes the field resolved for them. */
  unknownFields: UnknownFieldTemplate | undefined;
}

/**
 * Resolves a token key to its field definition.
 *
 * A key defined in `fields` resolves to that definition. Any other key resolves
 * to a `SimpleFieldDefinition` synthesized from the `unknownFields` template, or
 * to `null` when unknown keys are not allowed.
 */
export function resolveField(source: FieldResolutionSource, key: string): FieldDefinition | null {
  const defined = source.fields.find((field) => field.key === key);
  if (defined) return defined;

  const template = source.unknownFields;
  if (!template) return null;

  const field: SimpleFieldDefinition = {
    key,
    label: key,
    type: 'string',
    operators: template.operators ?? DEFAULT_OPERATORS,
    hideSingleOperator: template.hideSingleOperator,
    allowSpaces: template.allowSpaces,
    validate: template.validate,
    sanitize: template.sanitize,
  };
  return field;
}
