import type { Editor } from '@tiptap/core';
import type { SuggestionState } from '../../plugins/suggestion';
import type { CustomSuggestion, FieldDefinition } from '../../types';

export interface KeyboardContext {
  editor: Editor;
  suggestionState: SuggestionState | null | undefined;
}

export interface KeyboardCallbacks {
  onFieldSelect: (field: FieldDefinition) => void;
  onCustomSelect: (suggestion: CustomSuggestion) => void;
}
