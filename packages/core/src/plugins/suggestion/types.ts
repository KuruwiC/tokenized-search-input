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

/**
 * What a suggestion list is attached to. Value, date and datetime suggestions
 * belong to a token and follow it by id, so editing or moving the token keeps
 * them; suggestions typed in plain text sit at a document position.
 */
export type SuggestionAnchor = { readonly tokenId: string } | { readonly pos: number };

export interface SuggestionState {
  type: SuggestionType;
  fieldKey: string | null;
  query: string;
  items: ReadonlyArray<FieldDefinition | EnumValue>;
  customItems: readonly CustomSuggestion[];
  activeIndex: number;
  isLoading: boolean;
  anchor: SuggestionAnchor | null;
  dateValue: Date | null;
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
  anchor?: SuggestionAnchor | null;
  dateValue?: Date | null;
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
  anchor: null,
  dateValue: null,
  dismissed: false,
  customDisplayMode: null,
};
