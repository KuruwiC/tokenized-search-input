import { useMemo } from 'react';
import type { EditorConfig } from '../../extensions/editor-context';
import type { UnknownFieldTemplate } from '../../types';
import type { TokenizedSearchInputProps } from '../tokenized-search-input.types';

type ConfigProps = Pick<
  TokenizedSearchInputProps,
  | 'fields'
  | 'freeTextMode'
  | 'classNames'
  | 'unknownFields'
  | 'validation'
  | 'suggestions'
  | 'serialization'
  | 'labels'
  | 'pickers'
>;

/**
 * Derives the editor configuration from the component props. Unset members stay
 * `undefined`: the editor context owns the defaults. Members built from
 * several props keep their identity until one of those props changes, so an inline
 * `unknownFields={{ ... }}` or `validation={{ ... }}` does not re-sync the editor
 * context on every render.
 */
export function useEditorConfig({
  fields,
  freeTextMode,
  classNames,
  unknownFields,
  validation: validationConfig,
  suggestions = {},
  serialization = {},
  labels = {},
  pickers = {},
}: ConfigProps): EditorConfig {
  const hasUnknownFields = unknownFields !== undefined;
  const unknownOperators = unknownFields?.operators;
  const unknownHideSingleOperator = unknownFields?.hideSingleOperator;
  const unknownAllowSpaces = unknownFields?.allowSpaces;
  const unknownValidate = unknownFields?.validate;
  const unknownValidation = unknownFields?.validation;
  const unknownFieldTemplate = useMemo<UnknownFieldTemplate | undefined>(
    () =>
      hasUnknownFields
        ? {
            operators: unknownOperators,
            hideSingleOperator: unknownHideSingleOperator,
            allowSpaces: unknownAllowSpaces,
            validate: unknownValidate,
            validation: unknownValidation,
          }
        : undefined,
    [
      hasUnknownFields,
      unknownOperators,
      unknownHideSingleOperator,
      unknownAllowSpaces,
      unknownValidate,
      unknownValidation,
    ]
  );
  const validation = useMemo(
    () => (validationConfig?.rules ? { rules: validationConfig.rules } : undefined),
    [validationConfig?.rules]
  );

  return {
    fields,
    freeTextMode,
    unknownFields: unknownFieldTemplate,
    operatorLabels: labels.operators,
    fieldSuggestionsDisabled: suggestions.field?.disabled,
    valueSuggestionsDisabled: suggestions.value?.disabled,
    validation,
    deserializeText: serialization.deserializeText,
    serializeToken: serialization.serializeToken,
    classNames,
    renderDatePicker: pickers.renderDate,
    renderDateTimePicker: pickers.renderDateTime,
    paginationLabels: labels.pagination,
  };
}
