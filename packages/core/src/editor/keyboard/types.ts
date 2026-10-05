import type { Editor } from '@tiptap/core';
import type { SuggestionState } from '../../plugins/suggestion';
import type { CustomSuggestion, FieldDefinition, FreeTextMode } from '../../types';

export interface KeyboardContext {
  editor: Editor;
  freeTextMode: FreeTextMode;
  suggestionState: SuggestionState | null | undefined;
  delimiter: string;
}

export interface KeyboardCallbacks {
  onFieldSelect: (field: FieldDefinition) => void;
  onCustomSelect: (suggestion: CustomSuggestion) => void;
}
