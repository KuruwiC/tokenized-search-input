import type { Transaction } from '@tiptap/pm/state';
import type { DateTimeValue } from '../../pickers/date-time-value';
import type { CustomSuggestion, EnumValue, FieldDefinition } from '../../types';
import { positionAnchor, tokenAnchor } from './anchor';
import { suggestionEntries } from './entries';
import { suggestionKey } from './plugin';
import {
  type CustomDisplayMode,
  initialSuggestionState,
  isCloseMeta,
  isPickerType,
  type SuggestionMeta,
  type SuggestionState,
} from './types';

export function setSuggestion(tr: Transaction, meta: SuggestionMeta): Transaction {
  // Calls on one transaction merge instead of overwriting, and a close is final.
  const existing = tr.getMeta(suggestionKey) as SuggestionMeta | undefined;
  if (existing && isCloseMeta(existing)) {
    return tr;
  }

  const next = isCloseMeta(meta) ? meta : { ...(existing ?? {}), ...meta };
  return tr.setMeta(suggestionKey, next);
}

export function openFieldSuggestion(
  tr: Transaction,
  fields: FieldDefinition[],
  query: string = '',
  anchorPos: number | null = null
): Transaction {
  return setSuggestion(tr, {
    type: 'field',
    fieldKey: null,
    query,
    items: fields,
    customItems: [],
    custom: initialSuggestionState.custom,
    customDisplayMode: null,
    activeIndex: -1,
    isLoading: false,
    anchor: positionAnchor(anchorPos),
    dismissed: false,
  });
}

export function openValueSuggestion(
  tr: Transaction,
  fieldKey: string,
  items: readonly EnumValue[],
  query: string = '',
  tokenId: string | null = null
): Transaction {
  return setSuggestion(tr, {
    type: 'value',
    fieldKey,
    query,
    items,
    activeIndex: -1,
    isLoading: false,
    anchor: tokenAnchor(tokenId),
    dismissed: false,
  });
}

export function openDateSuggestion(
  tr: Transaction,
  fieldKey: string,
  currentValue: DateTimeValue | null = null,
  tokenId: string | null = null
): Transaction {
  return setSuggestion(tr, {
    type: 'date',
    fieldKey,
    query: '',
    items: [],
    activeIndex: -1,
    isLoading: false,
    anchor: tokenAnchor(tokenId),
    dateValue: currentValue,
    isUTC: false,
    includeTime: false,
    dismissed: false,
  });
}

export function openDateTimeSuggestion(
  tr: Transaction,
  fieldKey: string,
  currentValue: DateTimeValue | null = null,
  tokenId: string | null = null
): Transaction {
  return setSuggestion(tr, {
    type: 'datetime',
    fieldKey,
    query: '',
    items: [],
    activeIndex: -1,
    isLoading: false,
    anchor: tokenAnchor(tokenId),
    dateValue: currentValue,
    isUTC: currentValue?.offset === 'Z',
    includeTime: currentValue?.time !== undefined,
    dismissed: false,
  });
}

export function openCustomSuggestion(
  tr: Transaction,
  customItems: CustomSuggestion[],
  query: string = '',
  anchorPos: number | null = null,
  hasMore: boolean = false
): Transaction {
  return setSuggestion(tr, {
    type: 'custom',
    fieldKey: null,
    query,
    items: [],
    customItems,
    custom: { hasMore, offset: customItems.length, isLoadingMore: false },
    activeIndex: -1,
    isLoading: false,
    anchor: positionAnchor(anchorPos),
    dismissed: false,
  });
}

export function openFieldWithCustomSuggestion(
  tr: Transaction,
  fields: FieldDefinition[],
  customItems: CustomSuggestion[],
  displayMode: CustomDisplayMode,
  query: string = '',
  anchorPos: number | null = null,
  hasMore: boolean = false
): Transaction {
  return setSuggestion(tr, {
    type: 'fieldWithCustom',
    fieldKey: null,
    query,
    items: fields,
    customItems,
    custom: { hasMore, offset: customItems.length, isLoadingMore: false },
    activeIndex: -1,
    isLoading: false,
    anchor: positionAnchor(anchorPos),
    dismissed: false,
    customDisplayMode: displayMode,
  });
}

/** Marks the next page of custom suggestions as asked for, or as no longer awaited. */
export function setCustomLoadingMore(
  tr: Transaction,
  state: SuggestionState,
  isLoadingMore: boolean
): Transaction {
  return setSuggestion(tr, { custom: { ...state.custom, isLoadingMore } });
}

/** Adds the next page to the custom suggestions, keeping the same entry active and the anchor. */
export function appendCustomSuggestions(
  tr: Transaction,
  state: SuggestionState,
  page: readonly CustomSuggestion[],
  hasMore: boolean
): Transaction {
  const customItems = [...state.customItems, ...page];
  const active = suggestionEntries(state)[state.activeIndex];
  const activeIndex = active
    ? suggestionEntries({ ...state, customItems }).findIndex((entry) => entry.key === active.key)
    : state.activeIndex;
  return setSuggestion(tr, {
    customItems,
    custom: { hasMore, offset: state.custom.offset + page.length, isLoadingMore: false },
    activeIndex,
  });
}

export function updateSuggestionDateValue(
  tr: Transaction,
  dateValue: DateTimeValue | null
): Transaction {
  return setSuggestion(tr, { dateValue });
}

/** Sets the datetime picker mode for as long as there is no value to read it from. */
export function updateSuggestionTimeControls(
  tr: Transaction,
  controls: { isUTC?: boolean; includeTime?: boolean }
): Transaction {
  return setSuggestion(tr, controls);
}

export function closeSuggestion(tr: Transaction): Transaction {
  return setSuggestion(tr, { close: true });
}

export function dismissSuggestion(tr: Transaction): Transaction {
  return setSuggestion(tr, {
    type: null,
    dismissed: true,
  });
}

export function clearDismissed(tr: Transaction): Transaction {
  return setSuggestion(tr, { dismissed: false });
}

export function updateSuggestionActiveIndex(tr: Transaction, activeIndex: number): Transaction {
  return setSuggestion(tr, { activeIndex });
}

/**
 * Moves the active entry up or down, wrapping at both ends. From no active entry (-1),
 * down goes to the first entry and up to the last.
 */
export function navigateSuggestion(
  tr: Transaction,
  state: SuggestionState,
  direction: 'up' | 'down'
): void {
  const { activeIndex } = state;
  const itemCount = suggestionEntries(state).length;
  if (itemCount === 0) return;

  let newIndex: number;
  if (direction === 'down') {
    newIndex = activeIndex === -1 ? 0 : (activeIndex + 1) % itemCount;
  } else {
    newIndex = activeIndex <= 0 ? itemCount - 1 : activeIndex - 1;
  }

  updateSuggestionActiveIndex(tr, newIndex);
}

export function setSuggestionLoading(tr: Transaction, isLoading: boolean): Transaction {
  return setSuggestion(tr, { isLoading });
}

/**
 * Whether the suggestion has something to show: it has a type, is not dismissed, and
 * has entries to list. The date and datetime pickers need no entries.
 */
export function isSuggestionOpen(
  state: SuggestionState | null | undefined
): state is SuggestionState {
  if (state == null || state.type === null || state.dismissed) {
    return false;
  }

  if (isPickerType(state.type)) {
    return true;
  }

  if (state.type === 'custom') {
    return state.customItems.length > 0;
  }

  if (state.type === 'fieldWithCustom') {
    return state.items.length > 0 || state.customItems.length > 0;
  }

  return state.items.length > 0;
}
