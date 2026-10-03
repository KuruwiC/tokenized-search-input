import type { Editor } from '@tiptap/core';
import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { getEditorContext } from '../extensions/editor-context';
import { useEditorContextUpdate } from '../hooks/use-editor-context-update';
import { useEditorSelector } from '../hooks/use-editor-store';
import { usePluginState } from '../hooks/use-plugin-state';
import { useSuggestionPosition } from '../hooks/use-suggestion-position';
import { useVisualViewport } from '../hooks/use-visual-viewport';
import type { DateTimeValue } from '../pickers/date-time-value';
import {
  closeSuggestion,
  isSuggestionOpen,
  resolveAnchorPos,
  suggestionKey,
  updateSuggestionActiveIndex,
} from '../plugins/suggestion-plugin';
import type { CustomSuggestion, FieldDefinition } from '../types';
import { cn } from '../utils/cn';
import { useDatePickerState } from './hooks/use-date-picker-state';
import { useSuggestionDismissal } from './hooks/use-suggestion-dismissal';
import { useValueInput } from './hooks/use-value-input';
import { renderSuggestionContent } from './suggestion-content';
import { isPickerType } from './suggestion-type';

export interface SuggestionOverlayProps {
  editor: Editor;
  containerRef: RefObject<HTMLElement | null>;
  onFieldSelect: (field: FieldDefinition) => void;
  onValueSelect: (value: string) => void;
  onCustomSelect?: (suggestion: CustomSuggestion) => void;
  onDateChange?: (value: DateTimeValue | null, fieldKey: string) => void;
  onDateClose?: () => void;
  /** Callback to load more custom suggestions */
  onCustomLoadMore?: () => void;
  /** Whether expandOnFocus mode is enabled */
  expandOnFocus?: boolean;
  /** Stable ids shared by the combobox and its active options. */
  listboxId: string;
  optionIdPrefix: string;
}

/**
 * Places the open suggestion under its anchor and renders it. What a picker shows, how the
 * suggestion closes and where it goes are the business of the hooks it calls.
 */
export const SuggestionOverlay: React.FC<SuggestionOverlayProps> = ({
  editor,
  containerRef,
  onFieldSelect,
  onValueSelect,
  onCustomSelect,
  onDateChange,
  onDateClose,
  onCustomLoadMore,
  expandOnFocus = false,
  listboxId,
  optionIdPrefix,
}) => {
  const suggestionRef = useRef<HTMLDivElement>(null);
  const suggestionState = usePluginState(editor, suggestionKey);
  useEditorContextUpdate(editor);
  const { fields, classNames, renderDatePicker, renderDateTimePicker, paginationLabels } =
    getEditorContext(editor);
  const { height: viewportHeight } = useVisualViewport();
  const type = suggestionState?.type ?? null;
  const isPicker = isPickerType(type);

  const anchorPos = useEditorSelector(editor, (state) =>
    resolveAnchorPos(state.doc, suggestionKey.getState(state)?.anchor ?? null)
  );
  const position = useSuggestionPosition(
    editor,
    anchorPos,
    type,
    containerRef,
    suggestionRef,
    expandOnFocus
  );
  const { getValueInput, restoreFocus } = useValueInput(editor, containerRef, anchorPos);
  useSuggestionDismissal(editor, suggestionState, containerRef, suggestionRef, getValueInput);
  const datePicker = useDatePickerState(editor, suggestionState, onDateChange);

  useEffect(() => {
    if (!editor.isEditable && !editor.isDestroyed && isSuggestionOpen(suggestionState)) {
      const tr = editor.state.tr;
      closeSuggestion(tr);
      editor.view.dispatch(tr);
    }
  }, [editor, editor.isEditable, suggestionState]);

  const handleActiveChange = useCallback(
    (index: number) => {
      const tr = editor.state.tr;
      updateSuggestionActiveIndex(tr, index);
      editor.view.dispatch(tr);
    },
    [editor]
  );

  const handleDateClose = useCallback(() => {
    onDateClose?.();
    restoreFocus();
  }, [onDateClose, restoreFocus]);

  if (!editor.isEditable || !isSuggestionOpen(suggestionState)) {
    return null;
  }

  const { items, customItems, custom, activeIndex, query, fieldKey, dateValue, customDisplayMode } =
    suggestionState;
  if ((type === 'custom' || type === 'fieldWithCustom') && !onCustomSelect) return null;
  if (isPicker && !fields.some((field) => field.key === fieldKey)) return null;

  const content = renderSuggestionContent({
    type,
    items,
    customItems,
    activeIndex,
    query,
    fieldKey,
    dateValue,
    customDisplayMode,
    fields,
    classNames,
    onFieldSelect,
    onValueSelect,
    onCustomSelect,
    onActiveChange: handleActiveChange,
    customHasMore: custom.hasMore,
    customIsLoadingMore: custom.isLoadingMore,
    onCustomLoadMore,
    paginationLabels,
    listboxId,
    optionIdPrefix,
    syncedValue: datePicker.syncedValue,
    renderDatePicker,
    renderDateTimePicker,
    onDateChange: datePicker.onDateChange,
    onDateClose: handleDateClose,
    restoreFocus,
    isUTC: datePicker.isUTC,
    onUTCChange: datePicker.onUTCChange,
    includeTime: datePicker.includeTime,
    onIncludeTimeChange: datePicker.onIncludeTimeChange,
  });
  if (!content) return null;

  const top = position?.top;
  const maxDropdownHeight = Math.min(300, viewportHeight * 0.4);

  return (
    <div
      ref={suggestionRef}
      data-suggestion-root
      style={{
        left: position?.left ?? 0,
        top: top !== undefined ? `${top}px` : undefined,
        marginTop: top !== undefined ? '4px' : undefined,
        maxHeight: isPicker ? undefined : `${maxDropdownHeight}px`,
      }}
      className={cn(
        'tsi-popover',
        isPicker ? 'tsi-dropdown--date' : 'tsi-dropdown',
        top === undefined && 'tsi-dropdown--top-full',
        classNames?.dropdown
      )}
      // A list names its own listbox; a picker is a dialog the combobox points at
      role={isPicker ? 'dialog' : undefined}
      id={isPicker ? listboxId : undefined}
    >
      {content}
    </div>
  );
};
