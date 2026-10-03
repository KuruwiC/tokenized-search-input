import type { Editor } from '@tiptap/core';
import type { SuggestionState } from '../../plugins/suggestion';
import type {
  CustomSuggestion,
  FieldDefinition,
  FreeTextMode,
  UnknownFieldTemplate,
} from '../../types';

export interface KeyboardContext {
  editor: Editor;
  fields: FieldDefinition[];
  freeTextMode: FreeTextMode;
  unknownFields: UnknownFieldTemplate | undefined;
  suggestionState: SuggestionState | null | undefined;
  delimiter: string;
}

export interface KeyboardCallbacks {
  onFieldSelect: (field: FieldDefinition) => void;
  onValueSelect: (value: string) => void;
  onCustomSelect: (suggestion: CustomSuggestion) => void;
}

export function buildContext(
  editor: Editor,
  fields: FieldDefinition[],
  freeTextMode: FreeTextMode,
  unknownFields: UnknownFieldTemplate | undefined,
  suggestionState: SuggestionState | null | undefined,
  delimiter: string
): KeyboardContext {
  return {
    editor,
    fields,
    freeTextMode,
    unknownFields,
    suggestionState,
    delimiter,
  };
}
