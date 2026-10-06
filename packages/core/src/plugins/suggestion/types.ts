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

/** Whether the suggestion is a date or date-time picker, which only an explicit choice closes. */
export function isPickerType(type: SuggestionType): type is 'date' | 'datetime' {
  return type === 'date' || type === 'datetime';
}

/**
 * Whether the suggestion belongs to a token: value, date and datetime suggestions edit a
 * token's value, while field and custom suggestions belong to the text typed in the paragraph.
 */
export function isTokenSuggestionType(type: SuggestionType): type is 'value' | 'date' | 'datetime' {
  return type === 'value' || isPickerType(type);
}

export type CustomDisplayMode = 'prepend' | 'append';

interface CustomPagination {
  readonly hasMore: boolean;
  /** How many suggestions have been read, the offset of the next page. */
  readonly offset: number;
  readonly isLoadingMore: boolean;
}

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
  /** The pages of `customItems`; a suggestion that closes takes it back to the start. */
  custom: CustomPagination;
  activeIndex: number;
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
  /**
   * Whether the user closed the suggestion (Escape, Enter with no active entry, pressing or
   * moving focus elsewhere). Re-evaluation does not reopen it until the next input: a change
   * to the document, selection or token focus, or focus entering the input.
   */
  dismissed: boolean;
  /** Where the custom suggestions go in a fieldWithCustom list. */
  customDisplayMode: CustomDisplayMode | null;
}

export interface SetSuggestionMeta {
  type?: SuggestionType;
  fieldKey?: string | null;
  query?: string;
  items?: ReadonlyArray<FieldDefinition | EnumValue>;
  customItems?: readonly CustomSuggestion[];
  custom?: CustomPagination;
  activeIndex?: number;
  anchor?: SuggestionAnchor | null;
  dateValue?: DateTimeValue | null;
  isUTC?: boolean;
  includeTime?: boolean;
  dismissed?: boolean;
  customDisplayMode?: CustomDisplayMode | null;
}

export interface CloseSuggestionMeta {
  close: true;
  /** The user asked for the close; see `SuggestionState.dismissed`. */
  dismissed?: boolean;
}

export type SuggestionMeta = SetSuggestionMeta | CloseSuggestionMeta;

export function isCloseMeta(meta: SuggestionMeta): meta is CloseSuggestionMeta {
  return 'close' in meta && meta.close === true;
}

export const initialSuggestionState: SuggestionState = {
  type: null,
  fieldKey: null,
  query: '',
  items: [],
  customItems: [],
  custom: { hasMore: false, offset: 0, isLoadingMore: false },
  activeIndex: -1,
  anchor: null,
  dateValue: null,
  isUTC: false,
  includeTime: false,
  dismissed: false,
  customDisplayMode: null,
};
