import type { Editor } from '@tiptap/core';
import type { SuggestionState } from '../../plugins/suggestion-plugin';
import {
  type CustomSuggestion,
  DEFAULT_TOKEN_DELIMITER,
  type FieldDefinition,
  type FreeTextMode,
} from '../../types';

export interface KeyboardContext {
  editor: Editor;
  fields: FieldDefinition[];
  freeTextMode: FreeTextMode;
  allowUnknownFields: boolean;
  unknownFieldOperators: readonly string[] | undefined;
  suggestionState: SuggestionState | null | undefined;
  delimiter: string;
}

export interface KeyboardCallbacks {
  onFieldSelect: (field: FieldDefinition) => void;
  onValueSelect: (value: string) => void;
  onCustomSelect: (suggestion: CustomSuggestion) => void;
  onSubmit: () => void;
}

// Returns true if the event was handled and should stop propagation.
export type KeyboardStrategy = (context: KeyboardContext, callbacks: KeyboardCallbacks) => boolean;

export function buildContext(
  editor: Editor,
  fields: FieldDefinition[],
  freeTextMode: FreeTextMode,
  allowUnknownFields: boolean,
  unknownFieldOperators: readonly string[] | undefined,
  suggestionState: SuggestionState | null | undefined,
  delimiter: string = DEFAULT_TOKEN_DELIMITER
): KeyboardContext {
  return {
    editor,
    fields,
    freeTextMode,
    allowUnknownFields,
    unknownFieldOperators,
    suggestionState,
    delimiter,
  };
}
