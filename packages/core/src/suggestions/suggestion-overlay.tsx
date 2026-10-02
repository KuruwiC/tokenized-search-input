import type { Editor } from '@tiptap/react';
import { type RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { getEditorContext } from '../extensions/editor-context';
import { useDebouncedPickerSync } from '../hooks/use-debounced-picker-sync';
import { useEditorContextUpdate } from '../hooks/use-editor-context-update';
import { useEditorSelector } from '../hooks/use-editor-store';
import { usePluginState } from '../hooks/use-plugin-state';
import { useSuggestionPosition } from '../hooks/use-suggestion-position';
import { useVisualViewport } from '../hooks/use-visual-viewport';
import { parseDateFieldValue } from '../pickers/date-format';
import {
  type DateTimeValue,
  fromInstant,
  localMidnight,
  localOffsetAt,
  toInstant,
} from '../pickers/date-time-value';
import {
  closeSuggestion,
  isSuggestionOpen,
  resolveAnchorPos,
  suggestionKey,
  updateSuggestionActiveIndex,
  updateSuggestionDateValue,
  updateSuggestionTimeControls,
} from '../plugins/suggestion-plugin';
import type { CustomSuggestion, FieldDefinition } from '../types';
import { cn } from '../utils/cn';
import { findFocusedFilterToken, getContainingFilterToken } from '../utils/dom-focus';
import { type DismissReason, getDismissPolicy, shouldDismiss } from './dismiss-policy';
import {
  createBoundary,
  createTokenBoundary,
  createValueInputBoundary,
} from './interaction-boundary';
import { renderSuggestionContent } from './suggestion-content';
import { useDismissManager } from './use-dismiss-manager';

export interface SuggestionOverlayProps {
  editor: Editor;
  containerRef: RefObject<HTMLElement | null>;
  onFieldSelect: (field: FieldDefinition) => void;
  onValueSelect: (value: string) => void;
  onCustomSelect?: (suggestion: CustomSuggestion) => void;
  onDateChange?: (value: DateTimeValue | null, fieldKey: string) => void;
  onDateClose?: () => void;
  valueInputRef?: RefObject<HTMLInputElement | null>;
  /** Whether more custom suggestions can be loaded */
  customHasMore?: boolean;
  /** Whether loadMore is currently in progress */
  customIsLoadingMore?: boolean;
  /** Callback to load more custom suggestions */
  onCustomLoadMore?: () => void;
  /** Whether expandOnFocus mode is enabled */
  expandOnFocus?: boolean;
  /** Stable ids shared by the combobox and its active options. */
  listboxId: string;
  optionIdPrefix: string;
}

export const SuggestionOverlay: React.FC<SuggestionOverlayProps> = ({
  editor,
  containerRef,
  onFieldSelect,
  onValueSelect,
  onCustomSelect,
  onDateChange,
  onDateClose,
  valueInputRef,
  customHasMore,
  customIsLoadingMore,
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

  // Close suggestions when editor becomes non-editable (disabled)
  useEffect(() => {
    if (!editor.isEditable && !editor.isDestroyed && isSuggestionOpen(suggestionState)) {
      const tr = editor.state.tr;
      closeSuggestion(tr);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    }
  }, [editor, editor.isEditable, suggestionState]);

  const { height: viewportHeight } = useVisualViewport();

  const anchorPos = useEditorSelector(editor, (state) =>
    resolveAnchorPos(state.doc, suggestionKey.getState(state)?.anchor ?? null)
  );

  const position = useSuggestionPosition(
    editor,
    anchorPos,
    suggestionState?.type ?? null,
    containerRef,
    suggestionRef
  );

  // Get dismiss policy for boundary type determination
  const policy = getDismissPolicy(suggestionState?.type ?? null);
  const isDatePicker = policy.requireExplicitConfirm;

  // Lazy evaluation avoids stale refs - called at contains() time, not creation time
  const getTokenElement = useCallback((): HTMLElement | null => {
    // Find the currently focused token via data attribute (most reliable)
    const focusedToken = findFocusedFilterToken(containerRef.current);
    if (focusedToken) return focusedToken;

    if (anchorPos === null) return null;

    try {
      const domAtPos = editor.view.domAtPos(anchorPos);
      const node = domAtPos.node;
      const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      return getContainingFilterToken(element);
    } catch {
      return null;
    }
  }, [containerRef, anchorPos, editor.view]);

  const getValueInputElement = useCallback((): HTMLInputElement | null => {
    // First try provided ref
    if (valueInputRef?.current) {
      return valueInputRef.current;
    }

    // Otherwise find from token element
    const tokenElement = getTokenElement();
    return tokenElement?.querySelector('input[type="text"]') as HTMLInputElement | null;
  }, [valueInputRef, getTokenElement]);

  const boundary = useMemo(() => {
    switch (policy.boundaryType) {
      case 'token':
        return createTokenBoundary(getTokenElement, suggestionRef);
      case 'value-input':
        return createValueInputBoundary(getValueInputElement, suggestionRef);
      default:
        return createBoundary(containerRef, suggestionRef);
    }
  }, [policy.boundaryType, containerRef, getTokenElement, getValueInputElement]);

  // Re-check current state to avoid race conditions
  const handleDismiss = useCallback(
    (reason: DismissReason): boolean => {
      const currentState = suggestionKey.getState(editor.state);
      if (!currentState?.type) return false;

      const currentPolicy = getDismissPolicy(currentState.type);
      if (!shouldDismiss(currentPolicy, reason)) return false;

      const tr = editor.state.tr;
      closeSuggestion(tr);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
      return true;
    },
    [editor]
  );

  // Use dismiss manager for outside click and escape key handling
  useDismissManager(
    isSuggestionOpen(suggestionState),
    suggestionState?.type ?? null,
    boundary,
    handleDismiss
  );

  const handleActiveChange = useCallback(
    (index: number) => {
      const tr = editor.state.tr;
      updateSuggestionActiveIndex(tr, index);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    },
    [editor]
  );

  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const valueInput = getValueInputElement();
      if (valueInput) {
        valueInput.focus();
        const len = valueInput.value.length;
        valueInput.setSelectionRange(len, len);
        // Scroll input to show cursor position at the end
        valueInput.scrollLeft = valueInput.scrollWidth;
        // Scroll editor container to make value input visible (for narrow viewports)
        valueInput.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });
  }, [getValueInputElement]);

  const pendingDateChange = useRef<DateTimeValue | null>(null);
  const rafId = useRef<number | null>(null);

  // The field of the picker, for the flush that follows the picker closing
  const prevFieldKeyRef = useRef<string | null>(suggestionState?.fieldKey ?? null);
  useEffect(() => {
    if (suggestionState?.type) {
      prevFieldKeyRef.current = suggestionState.fieldKey;
    }
  }, [suggestionState?.type, suggestionState?.fieldKey]);

  const flushAndCancelPendingDateChange = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    const valueToUpdate = pendingDateChange.current;
    if (valueToUpdate === null) return;

    pendingDateChange.current = null;

    // Get latest state to avoid stale closure
    const currentSuggestionState = suggestionKey.getState(editor.state);
    if (!currentSuggestionState) return;

    // Use the previous field if there is none now (picker just closed)
    const fieldKeyToUse = currentSuggestionState.fieldKey ?? prevFieldKeyRef.current;

    // Update suggestion state
    const tr = editor.state.tr;
    updateSuggestionDateValue(tr, valueToUpdate);
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);

    // Update token in real-time
    if (fieldKeyToUse) {
      onDateChange?.(valueToUpdate, fieldKeyToUse);
    }
  }, [editor, onDateChange]);

  const handleDateChangeInternal = useCallback(
    (value: DateTimeValue | null) => {
      // Store latest value for throttled update
      pendingDateChange.current = value;

      // Throttle updates via requestAnimationFrame
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null;
          flushAndCancelPendingDateChange();
        });
      }
    },
    [flushAndCancelPendingDateChange]
  );

  const prevSuggestionTypeRef = useRef(suggestionState?.type);

  useEffect(() => {
    const prevType = prevSuggestionTypeRef.current;
    const currentType = suggestionState?.type;

    // Flush if type changed (e.g., picker closed or switched to different type)
    if (prevType !== currentType && prevType != null) {
      flushAndCancelPendingDateChange();
    }

    prevSuggestionTypeRef.current = currentType;
  }, [suggestionState?.type, flushAndCancelPendingDateChange]);

  useEffect(() => {
    return () => {
      flushAndCancelPendingDateChange();
    };
  }, [flushAndCancelPendingDateChange]);

  // The text of the token the picker belongs to, as it is typed
  const tokenInputValue = useEditorSelector(editor, (state) => {
    const current = suggestionKey.getState(state);
    if (current?.type !== 'date' && current?.type !== 'datetime') return '';
    const pos = resolveAnchorPos(state.doc, current.anchor);
    return pos === null ? '' : String(state.doc.nodeAt(pos)?.attrs.value ?? '');
  });

  const pickerType =
    suggestionState?.type === 'date' || suggestionState?.type === 'datetime'
      ? suggestionState.type
      : null;
  const pickerField = suggestionState?.fieldKey
    ? fields.find((field) => field.key === suggestionState.fieldKey)
    : undefined;
  const parseTyped = useCallback(
    (input: string): DateTimeValue | null => {
      if (pickerField?.type !== 'date' && pickerField?.type !== 'datetime') return null;
      const parsed = parseDateFieldValue(input, pickerField);
      return parsed.ok ? parsed.value : null;
    },
    [pickerField]
  );

  const { value: syncedValue, complete } = useDebouncedPickerSync({
    inputValue: tokenInputValue,
    selectedValue: suggestionState?.dateValue ?? null,
    type: pickerType,
    parse: parseTyped,
    delay: 200,
  });

  // The picker mode comes from the value the token holds in full, or else the one the
  // picker last committed: partial input only moves the calendar. While there is no
  // value, the state is all there is to go by.
  const settled = complete ?? suggestionState?.dateValue ?? null;
  const timeRequired = pickerField?.type === 'datetime' && pickerField.timeRequired === true;
  const isUTC =
    settled?.time !== undefined ? settled.offset === 'Z' : (suggestionState?.isUTC ?? false);
  const includeTime =
    timeRequired ||
    (settled ? settled.time !== undefined : (suggestionState?.includeTime ?? false));

  const setTimeControls = useCallback(
    (controls: { isUTC?: boolean; includeTime?: boolean }) => {
      const tr = editor.state.tr;
      updateSuggestionTimeControls(tr, controls);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    },
    [editor]
  );

  const handleUTCChangeInternal = useCallback(
    (nextIsUTC: boolean) => {
      // Remembered for the time a value has none, such as after its time was removed
      setTimeControls({ isUTC: nextIsUTC });
      if (settled?.time === undefined) return;
      // The same moment, written in UTC or in the local offset
      const instant = toInstant(settled);
      const converted = fromInstant(instant, nextIsUTC ? 'Z' : localOffsetAt(instant));
      if (converted) handleDateChangeInternal(converted);
    },
    [settled, setTimeControls, handleDateChangeInternal]
  );

  const handleIncludeTimeChangeInternal = useCallback(
    (nextIncludeTime: boolean) => {
      if (!settled) {
        setTimeControls({ includeTime: nextIncludeTime });
        return;
      }
      if (!nextIncludeTime) {
        handleDateChangeInternal({ date: settled.date });
        return;
      }
      if (settled.time !== undefined) return;
      handleDateChangeInternal(
        isUTC ? { date: settled.date, time: '00:00:00', offset: 'Z' } : localMidnight(settled.date)
      );
    },
    [settled, isUTC, setTimeControls, handleDateChangeInternal]
  );

  const handleDateCloseInternal = useCallback(() => {
    onDateClose?.();
    restoreFocus();
  }, [onDateClose, restoreFocus]);

  if (!editor.isEditable || !isSuggestionOpen(suggestionState)) {
    return null;
  }

  const { type, items, customItems, activeIndex, query, fieldKey, dateValue, customDisplayMode } =
    suggestionState;

  if ((type === 'custom' || type === 'fieldWithCustom') && !onCustomSelect) return null;
  if ((type === 'date' || type === 'datetime') && !fields.some((field) => field.key === fieldKey)) {
    return null;
  }

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
    customHasMore,
    customIsLoadingMore,
    onCustomLoadMore,
    paginationLabels,
    optionIdPrefix,
    syncedValue,
    renderDatePicker,
    renderDateTimePicker,
    onDateChange: handleDateChangeInternal,
    onDateClose: handleDateCloseInternal,
    restoreFocus,
    isUTC,
    onUTCChange: handleUTCChangeInternal,
    includeTime,
    onIncludeTimeChange: handleIncludeTimeChangeInternal,
  });
  if (!content) return null;

  const role =
    type === 'field' || type === 'value' || type === 'custom' || type === 'fieldWithCustom'
      ? 'listbox'
      : 'dialog';

  const maxDropdownHeight = Math.min(300, viewportHeight * 0.4);

  const getExpandedTop = (): number | undefined => {
    if (!expandOnFocus || !containerRef.current) return undefined;
    // Check if container has focus within (matches CSS :focus-within state)
    if (!containerRef.current.matches(':focus-within')) return undefined;
    const editorContent = containerRef.current.querySelector('.tsi-input');
    if (!editorContent) return undefined;
    return editorContent.scrollHeight;
  };
  const expandedTop = getExpandedTop();

  const dropdownBaseClasses = isDatePicker ? 'tsi-dropdown--date' : 'tsi-dropdown';

  return (
    <div
      ref={suggestionRef}
      data-suggestion-root
      style={{
        left: position?.left ?? 0,
        top: expandedTop !== undefined ? `${expandedTop}px` : undefined,
        marginTop: expandedTop !== undefined ? '4px' : undefined,
        maxHeight: isDatePicker ? undefined : `${maxDropdownHeight}px`,
      }}
      className={cn(
        dropdownBaseClasses,
        expandedTop === undefined && 'tsi-dropdown--top-full',
        classNames?.dropdown
      )}
      role={role}
      id={listboxId}
    >
      {content}
    </div>
  );
};
