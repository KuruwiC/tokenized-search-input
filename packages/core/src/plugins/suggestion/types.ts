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

/** How far the pages of custom suggestions have been read. */
export interface CustomPagination {
  readonly hasMore: boolean;
  /** How many suggestions have been read, the offset of the next page. */
  readonly offset: number;
  /** Whether a page has been asked for and has not arrived. */
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
  custom?: CustomPagination;
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
  isLoading: false,
  anchor: null,
  dateValue: null,
  isUTC: false,
  includeTime: false,
  dismissed: false,
  customDisplayMode: null,
};
