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
  type SuggestionMeta,
  type SuggestionState,
} from './types';

export function setSuggestion(tr: Transaction, meta: SuggestionMeta): Transaction {
  // Auto-merge with existing meta to prevent overwrites when setSuggestion
  // is called multiple times in the same transaction
  const existing = tr.getMeta(suggestionKey) as SuggestionMeta | undefined;

  // If existing is a close meta, preserve it (close is terminal)
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
 * Navigate suggestion index up or down with wrapping.
 * - Down from last item wraps to first (index 0)
 * - Up from first item (index 0) wraps to last
 * - Navigation starts at index 0 when entering from unselected state (-1)
 *
 * @param tr - Transaction to apply the navigation to (mutated in place)
 * @param state - Current suggestion state
 * @param direction - Navigation direction ('up' or 'down')
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
    // Wrap from first item to last, or from unselected to last
    newIndex = activeIndex <= 0 ? itemCount - 1 : activeIndex - 1;
  }

  updateSuggestionActiveIndex(tr, newIndex);
}

export function setSuggestionLoading(tr: Transaction, isLoading: boolean): Transaction {
  return setSuggestion(tr, { isLoading });
}

/**
 * Check if the suggestion menu is open and ready for display.
 *
 * The suggestion is considered "open" when ALL of the following conditions are met:
 * - State is initialized (not null or undefined)
 * - Suggestion type is set ('field', 'value', 'date', 'datetime', 'custom', or 'fieldWithCustom', not null)
 * - Suggestion has not been dismissed by user action (Escape key, etc.)
 * - For field/value types: there are items to display (non-empty list)
 * - For custom type: there are customItems to display (non-empty list)
 * - For fieldWithCustom type: there are items or customItems to display
 * - For date/datetime types: always open (picker doesn't need items)
 *
 * @param state - The suggestion state from the editor
 * @returns true if all conditions for display are met, false otherwise
 */
export function isSuggestionOpen(
  state: SuggestionState | null | undefined
): state is SuggestionState {
  if (state == null || state.type === null || state.dismissed) {
    return false;
  }

  // Date/datetime pickers don't need items
  if (state.type === 'date' || state.type === 'datetime') {
    return true;
  }

  // Custom suggestions need customItems
  if (state.type === 'custom') {
    return state.customItems.length > 0;
  }

  // fieldWithCustom needs at least items or customItems
  if (state.type === 'fieldWithCustom') {
    return state.items.length > 0 || state.customItems.length > 0;
  }

  // Field/value suggestions need items
  return state.items.length > 0;
}
