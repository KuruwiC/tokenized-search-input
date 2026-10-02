import type { Editor } from '@tiptap/react';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEditorContext } from '../extensions/editor-context';
import { useDebouncedPickerSync } from '../hooks/use-debounced-picker-sync';
import { useEditorContextUpdate } from '../hooks/use-editor-context-update';
import { useEditorSelector } from '../hooks/use-editor-store';
import { usePluginState } from '../hooks/use-plugin-state';
import { useSuggestionPosition } from '../hooks/use-suggestion-position';
import { useVisualViewport } from '../hooks/use-visual-viewport';
import { isDateOnlyValue, isUTCValue } from '../pickers/date-format';
import {
  closeSuggestion,
  isSuggestionOpen,
  resolveAnchorPos,
  type SuggestionType,
  suggestionKey,
  updateSuggestionActiveIndex,
  updateSuggestionDateValue,
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
  onDateChange?: (
    date: Date | null,
    fieldKey: string,
    isUTC?: boolean,
    includeTime?: boolean
  ) => void;
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
  const [isUTC, setIsUTC] = useState(false);

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

    // Fallback: the token the suggestion is anchored to
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

  const pendingDateChange = useRef<Date | null>(null);
  const rafId = useRef<number | null>(null);

  const isUTCRef = useRef(isUTC);
  useEffect(() => {
    isUTCRef.current = isUTC;
  }, [isUTC]);

  // Track includeTime state from datetime picker
  const [includeTime, setIncludeTime] = useState(false);
  const includeTimeRef = useRef(includeTime);
  useEffect(() => {
    includeTimeRef.current = includeTime;
  }, [includeTime]);

  // Track the previous suggestion state for use after picker closes
  const prevSuggestionStateForFlushRef = useRef<{
    type: SuggestionType;
    fieldKey: string | null;
  }>({
    type: suggestionState?.type ?? null,
    fieldKey: suggestionState?.fieldKey ?? null,
  });
  useEffect(() => {
    if (suggestionState?.type) {
      prevSuggestionStateForFlushRef.current = {
        type: suggestionState.type,
        fieldKey: suggestionState.fieldKey,
      };
    }
  }, [suggestionState?.type, suggestionState?.fieldKey]);

  const flushAndCancelPendingDateChange = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    const dateToUpdate = pendingDateChange.current;
    if (dateToUpdate === null) return;

    pendingDateChange.current = null;

    // Get latest state to avoid stale closure
    const currentSuggestionState = suggestionKey.getState(editor.state);
    if (!currentSuggestionState) return;

    // Use previous values if current values are null (picker just closed)
    const fieldKeyToUse =
      currentSuggestionState.fieldKey ?? prevSuggestionStateForFlushRef.current.fieldKey;
    const suggestionType =
      currentSuggestionState.type ?? prevSuggestionStateForFlushRef.current.type;

    // Update suggestion state
    const tr = editor.state.tr;
    updateSuggestionDateValue(tr, dateToUpdate);
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);

    // Update token in real-time
    if (fieldKeyToUse) {
      const useUTC = suggestionType === 'datetime' ? isUTCRef.current : undefined;
      const useIncludeTime = suggestionType === 'datetime' ? includeTimeRef.current : undefined;
      onDateChange?.(dateToUpdate, fieldKeyToUse, useUTC, useIncludeTime);
    }
  }, [editor, onDateChange]);

  const handleDateChangeInternal = useCallback(
    (date: Date | null) => {
      // Store latest date for throttled update
      pendingDateChange.current = date;

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

  // useEffect + state because ProseMirror doc reference doesn't change (useMemo won't work)
  const [tokenInputValue, setTokenInputValue] = useState('');

  useEffect(() => {
    // Only monitor when date/datetime suggestion is open
    const isDateOrDateTime =
      suggestionState?.type === 'date' || suggestionState?.type === 'datetime';
    if (!isDateOrDateTime) {
      setTokenInputValue('');
      // Reset UTC and includeTime state when leaving datetime mode
      setIsUTC(false);
      setIncludeTime(false);
      return;
    }

    const tokenValueAt = (pos: number | null): string | null =>
      pos === null ? null : String(editor.state.doc.nodeAt(pos)?.attrs.value ?? '');

    const updateValue = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      // Skip if document wasn't changed (performance optimization)
      if (!transaction.docChanged) return;

      // Read the anchor from plugin state directly to avoid stale closure
      const currentAnchor = suggestionKey.getState(editor.state)?.anchor ?? null;
      setTokenInputValue(tokenValueAt(resolveAnchorPos(editor.state.doc, currentAnchor)) ?? '');
    };

    // Set initial value and UTC state
    const initialValue = tokenValueAt(anchorPos);
    if (initialValue !== null) {
      setTokenInputValue(initialValue);
      // Initialize UTC checkbox based on value (default to false for empty values)
      if (suggestionState?.type === 'datetime') {
        setIsUTC(initialValue ? isUTCValue(initialValue) : false);
        // Initialize includeTime: true if value contains time, or if timeRequired is set
        const fieldDef = suggestionState.fieldKey
          ? fields.find((f) => f.key === suggestionState.fieldKey)
          : undefined;
        if (fieldDef?.type === 'datetime') {
          const valueHasTime = !!initialValue && !isDateOnlyValue(initialValue);
          setIncludeTime(fieldDef.timeRequired === true || valueHasTime);
        }
      }
    } else if (suggestionState?.type === 'datetime') {
      // No anchored token but datetime type - reset UTC and includeTime
      setIsUTC(false);
      setIncludeTime(false);
    }

    editor.on('transaction', updateValue);
    return () => {
      editor.off('transaction', updateValue);
    };
  }, [editor, anchorPos, suggestionState?.type, suggestionState?.fieldKey, fields]);

  const { date: syncedDate } = useDebouncedPickerSync({
    inputValue: tokenInputValue,
    selectedDate: suggestionState?.dateValue ?? null,
    type: (suggestionState?.type === 'date' || suggestionState?.type === 'datetime'
      ? suggestionState.type
      : null) as 'date' | 'datetime' | null,
    isUTC,
    delay: 200,
  });

  const handleUTCChangeInternal = useCallback(
    (newIsUTC: boolean) => {
      setIsUTC(newIsUTC);

      // Recalculate token value with new UTC setting
      // Use synced date from input if available, otherwise fall back to committed value
      const fieldKeyToUse = suggestionState?.fieldKey;
      const currentDate = syncedDate ?? suggestionState?.dateValue;

      if (currentDate && fieldKeyToUse) {
        onDateChange?.(currentDate, fieldKeyToUse, newIsUTC, includeTimeRef.current);
      }
    },
    [suggestionState?.fieldKey, suggestionState?.dateValue, syncedDate, onDateChange]
  );

  const handleIncludeTimeChangeInternal = useCallback((newIncludeTime: boolean) => {
    setIncludeTime(newIncludeTime);
    // Don't call onDateChange here - the picker component will handle
    // restoring localTime when includeTime is toggled back on.
  }, []);

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
    syncedDate,
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
