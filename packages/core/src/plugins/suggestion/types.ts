import type { DateTimeValue } from '../../pickers/date-time-value';
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
  /** The date or date-time the picker last committed, or the token's when it opened. */
  dateValue: DateTimeValue | null;
  /**
   * Whether a datetime picker with no value to read it from works in UTC. Once there is
   * a value with a time, its offset says.
   */
  isUTC: boolean;
  /**
   * Whether a datetime picker with no value to read it from includes the time. Once
   * there is a value, whether it has a time says.
   */
  includeTime: boolean;
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
  dateValue?: DateTimeValue | null;
  isUTC?: boolean;
  includeTime?: boolean;
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
  isUTC: false,
  includeTime: false,
  dismissed: false,
  customDisplayMode: null,
};
