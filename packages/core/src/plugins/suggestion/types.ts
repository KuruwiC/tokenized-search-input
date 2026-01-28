import type { CustomSuggestion, EnumValue, FieldDefinition } from '../../types';

export type SuggestionType =
  | 'field'
  | 'value'
  | 'date'
  | 'datetime'
  | 'custom'
  | 'fieldWithCustom'
  | null;

export type CustomDisplayMode = 'prepend' | 'append';

export interface SuggestionState {
  type: SuggestionType;
  fieldKey: string | null;
  query: string;
  items: ReadonlyArray<FieldDefinition | EnumValue>;
  customItems: readonly CustomSuggestion[];
  activeIndex: number;
  isLoading: boolean;
  anchorPos: number | null;
  dateValue: Date | null;
  fieldSuggestionsDisabled: boolean;
  valueSuggestionsDisabled: boolean;
  dismissed: boolean;
  /** Display mode for fieldWithCustom type */
  customDisplayMode: CustomDisplayMode | null;
}

export interface SetSuggestionMeta {
  type?: SuggestionType;
  fieldKey?: string | null;
  query?: string;
  items?: ReadonlyArray<FieldDefinition | EnumValue>;
  customItems?: readonly CustomSuggestion[];
  activeIndex?: number;
  isLoading?: boolean;
  anchorPos?: number | null;
  dateValue?: Date | null;
  fieldSuggestionsDisabled?: boolean;
  valueSuggestionsDisabled?: boolean;
  dismissed?: boolean;
  customDisplayMode?: CustomDisplayMode | null;
}

export interface CloseSuggestionMeta {
  close: true;
}

export type SuggestionMeta = SetSuggestionMeta | CloseSuggestionMeta;

export const initialSuggestionState: SuggestionState = {
  type: null,
  fieldKey: null,
  query: '',
  items: [],
  customItems: [],
  activeIndex: -1,
  isLoading: false,
  anchorPos: null,
  dateValue: null,
  fieldSuggestionsDisabled: false,
  valueSuggestionsDisabled: false,
  dismissed: false,
  customDisplayMode: null,
};
