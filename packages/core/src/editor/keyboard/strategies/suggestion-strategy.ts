import { closeSuggestion, navigateSuggestion } from '../../../plugins/suggestion-plugin';
import { getFieldsInDisplayOrder } from '../../../suggestions/field-suggestion-list';
import type { CustomSuggestion, FieldDefinition } from '../../../types';
import { isSuggestionOpen, isTokenFocused } from '../guards';
import type { KeyboardCallbacks, KeyboardContext } from '../types';

export function handleArrowDown(ctx: KeyboardContext): boolean {
  const { editor, suggestionState } = ctx;

  // isSuggestionOpen already checks for null/undefined
  if (!isSuggestionOpen(suggestionState)) {
    return false;
  }

  const tr = editor.state.tr;
  navigateSuggestion(tr, suggestionState, 'down');
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
  return true;
}

export function handleArrowUp(ctx: KeyboardContext): boolean {
  const { editor, suggestionState } = ctx;

  // isSuggestionOpen already checks for null/undefined
  if (!isSuggestionOpen(suggestionState)) {
    return false;
  }

  const tr = editor.state.tr;
  navigateSuggestion(tr, suggestionState, 'up');
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
  return true;
}

/**
 * Handle Enter key for suggestion selection.
 * - If an item is selected (activeIndex >= 0), select it
 * - If no item is selected (activeIndex === -1), close suggestions without selecting
 * Returns true if handled, false otherwise.
 */
export function handleEnterOnSuggestion(
  ctx: KeyboardContext,
  callbacks: KeyboardCallbacks
): boolean {
  const { editor, suggestionState } = ctx;

  // isSuggestionOpen already checks for null/undefined
  if (!isSuggestionOpen(suggestionState)) {
    return false;
  }

  const items = suggestionState.items;
  const activeIndex = suggestionState.activeIndex;

  // Handle custom suggestions
  if (suggestionState.type === 'custom') {
    const customItems = suggestionState.customItems;
    if (activeIndex >= 0 && activeIndex < customItems.length) {
      const selectedCustom = customItems[activeIndex] as CustomSuggestion;
      callbacks.onCustomSelect(selectedCustom);
      return true;
    }
  }

  // Handle fieldWithCustom suggestions (prepend/append mode)
  if (suggestionState.type === 'fieldWithCustom') {
    const customItems = suggestionState.customItems;
    const fieldItems = items as FieldDefinition[];
    const displayOrderFields = getFieldsInDisplayOrder(fieldItems);
    const isPrepend = suggestionState.customDisplayMode === 'prepend';

    if (activeIndex >= 0) {
      if (isPrepend) {
        // Prepend mode: custom items first, then field items
        if (activeIndex < customItems.length) {
          const selectedCustom = customItems[activeIndex] as CustomSuggestion;
          callbacks.onCustomSelect(selectedCustom);
          return true;
        }
        const fieldIndex = activeIndex - customItems.length;
        if (fieldIndex < displayOrderFields.length) {
          const selectedField = displayOrderFields[fieldIndex];
          callbacks.onFieldSelect(selectedField);
          return true;
        }
      } else {
        // Append mode: field items first, then custom items
        if (activeIndex < displayOrderFields.length) {
          const selectedField = displayOrderFields[activeIndex];
          callbacks.onFieldSelect(selectedField);
          return true;
        }
        const customIndex = activeIndex - displayOrderFields.length;
        if (customIndex < customItems.length) {
          const selectedCustom = customItems[customIndex] as CustomSuggestion;
          callbacks.onCustomSelect(selectedCustom);
          return true;
        }
      }
    }
  }

  // If an item is selected, select it
  if (activeIndex >= 0 && activeIndex < items.length) {
    if (suggestionState.type === 'field') {
      // Use display order to match visual order in FieldSuggestionList
      const displayOrderFields = getFieldsInDisplayOrder(items as FieldDefinition[]);
      const selectedField = displayOrderFields[activeIndex];
      callbacks.onFieldSelect(selectedField);
      return true;
    }
    if (suggestionState.type === 'value') {
      const selectedValue = items[activeIndex] as string;
      callbacks.onValueSelect(selectedValue);
      return true;
    }
  }

  // No item selected (activeIndex === -1) or no items - close suggestions
  // This provides predictable UX: first Enter closes, second Enter triggers search
  const tr = editor.state.tr;
  closeSuggestion(tr);
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
  return true;
}

/**
 * Handle Escape key to close suggestions.
 * When a token is focused, ESC handling is delegated to Token.handleKeyDown
 * which implements 2-stage behavior (1st closes suggestions, 2nd exits token).
 */
export function handleEscape(ctx: KeyboardContext): boolean {
  const { editor, suggestionState } = ctx;

  // Delegate to Token when focused (Token implements 2-stage ESC behavior)
  if (isTokenFocused(editor)) {
    return false;
  }

  if (!isSuggestionOpen(suggestionState)) {
    return false;
  }

  const tr = editor.state.tr;
  closeSuggestion(tr);
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
  return true;
}
