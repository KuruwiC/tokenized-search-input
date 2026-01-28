import type { Editor } from '@tiptap/react';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedPickerSync } from '../hooks/use-debounced-picker-sync';
import { usePluginState } from '../hooks/use-plugin-state';
import { useSuggestionPosition } from '../hooks/use-suggestion-position';
import { useVisualViewport } from '../hooks/use-visual-viewport';
import { isDateOnlyValue, isUTCValue } from '../pickers/date-format';
import { DefaultDatePicker } from '../pickers/default-date-picker';
import { DefaultDateTimePicker } from '../pickers/default-datetime-picker';
import {
  closeSuggestion,
  isSuggestionOpen,
  type SuggestionType,
  suggestionKey,
  updateSuggestionActiveIndex,
  updateSuggestionDateValue,
} from '../plugins/suggestion-plugin';
import type {
  ClassNames,
  CustomSuggestion,
  DateFieldDefinition,
  DatePickerRenderProps,
  DateTimeFieldDefinition,
  DateTimePickerRenderProps,
  EnumValue,
  FieldDefinition,
  PaginationLabels,
} from '../types';
import { cn } from '../utils/cn';
import { findFocusedFilterToken, getContainingFilterToken } from '../utils/dom-focus';
import { CustomSuggestionList } from './custom-suggestion-list';

import { type DismissReason, getDismissPolicy, shouldDismiss } from './dismiss-policy';
import { FieldSuggestionList } from './field-suggestion-list';
import {
  createBoundary,
  createTokenBoundary,
  createValueInputBoundary,
} from './interaction-boundary';
import { useDismissManager } from './use-dismiss-manager';
import { ValueSuggestionList } from './value-suggestion-list';

export interface SuggestionOverlayProps {
  editor: Editor;
  containerRef: RefObject<HTMLElement | null>;
  fields: FieldDefinition[];
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
  /** Custom class names for styling component parts */
  classNames?: ClassNames;
  /** Whether more custom suggestions can be loaded */
  customHasMore?: boolean;
  /** Whether loadMore is currently in progress */
  customIsLoadingMore?: boolean;
  /** Callback to load more custom suggestions */
  onCustomLoadMore?: () => void;
  /** Whether expandOnFocus mode is enabled */
  expandOnFocus?: boolean;
  /**
   * Custom date picker component for all date fields.
   * Field-level renderPicker takes precedence if defined.
   */
  renderDatePicker?: (props: DatePickerRenderProps) => React.ReactNode;
  /**
   * Custom datetime picker component for all datetime fields.
   * Field-level renderPicker takes precedence if defined.
   */
  renderDateTimePicker?: (props: DateTimePickerRenderProps) => React.ReactNode;
  /** Labels for pagination UI in custom suggestion list */
  paginationLabels?: PaginationLabels;
}

export const SuggestionOverlay: React.FC<SuggestionOverlayProps> = ({
  editor,
  containerRef,
  fields,
  onFieldSelect,
  onValueSelect,
  onCustomSelect,
  onDateChange,
  onDateClose,
  valueInputRef,
  classNames,
  customHasMore,
  customIsLoadingMore,
  onCustomLoadMore,
  expandOnFocus = false,
  renderDatePicker,
  renderDateTimePicker,
  paginationLabels,
}) => {
  const suggestionRef = useRef<HTMLDivElement>(null);
  const suggestionState = usePluginState(editor, suggestionKey);
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

  const position = useSuggestionPosition(
    editor,
    suggestionState?.anchorPos ?? null,
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

    // Fallback: try to find from anchorPos if no focused token
    const anchorPos = suggestionState?.anchorPos;
    if (anchorPos === null || anchorPos === undefined) return null;

    try {
      const domAtPos = editor.view.domAtPos(anchorPos);
      const node = domAtPos.node;
      const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      return getContainingFilterToken(element);
    } catch {
      return null;
    }
  }, [containerRef, suggestionState?.anchorPos, editor.view]);

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

    const updateValue = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      // Skip if document wasn't changed (performance optimization)
      if (!transaction.docChanged) return;

      // Get anchorPos from plugin state directly to avoid stale closure
      const currentSuggestionState = suggestionKey.getState(editor.state);
      const anchorPos = currentSuggestionState?.anchorPos;
      if (anchorPos === null || anchorPos === undefined) {
        setTokenInputValue('');
        return;
      }
      try {
        const node = editor.state.doc.nodeAt(anchorPos);
        setTokenInputValue((node?.attrs?.value as string) ?? '');
      } catch {
        setTokenInputValue('');
      }
    };

    // Set initial value and UTC state
    const anchorPos = suggestionState?.anchorPos;
    if (anchorPos !== null && anchorPos !== undefined) {
      try {
        const node = editor.state.doc.nodeAt(anchorPos);
        const initialValue = (node?.attrs?.value as string) ?? '';
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
      } catch {
        setTokenInputValue('');
        if (suggestionState?.type === 'datetime') {
          setIsUTC(false);
          setIncludeTime(false);
        }
      }
    } else if (suggestionState?.type === 'datetime') {
      // No anchor position but datetime type - reset UTC and includeTime
      setIsUTC(false);
      setIncludeTime(false);
    }

    editor.on('transaction', updateValue);
    return () => {
      editor.off('transaction', updateValue);
    };
  }, [
    editor,
    suggestionState?.anchorPos,
    suggestionState?.type,
    suggestionState?.fieldKey,
    fields,
  ]);

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

  const currentFieldDef = fieldKey ? fields.find((f) => f.key === fieldKey) : undefined;

  const renderContent = () => {
    switch (type) {
      case 'field':
        return (
          <FieldSuggestionList
            fields={items as FieldDefinition[]}
            onSelect={onFieldSelect}
            activeIndex={activeIndex}
            onActiveChange={handleActiveChange}
            itemClassName={classNames?.suggestionItem}
            hintClassName={classNames?.suggestionItemHint}
            iconClassName={classNames?.suggestionItemIcon}
            categoryClassName={classNames?.fieldCategory}
          />
        );

      case 'value':
        return (
          <ValueSuggestionList
            items={items as EnumValue[]}
            currentValue={query}
            onSelect={onValueSelect}
            activeIndex={activeIndex}
            onActiveChange={handleActiveChange}
            itemClassName={classNames?.suggestionItem}
          />
        );

      case 'custom':
        if (!onCustomSelect) return null;
        return (
          <CustomSuggestionList
            items={customItems}
            onSelect={onCustomSelect}
            activeIndex={activeIndex}
            onActiveChange={handleActiveChange}
            itemClassName={classNames?.suggestionItem}
            descriptionClassName={classNames?.suggestionItemDescription}
            hasMore={customHasMore}
            isLoadingMore={customIsLoadingMore}
            onLoadMore={onCustomLoadMore}
            paginationLabels={paginationLabels}
          />
        );

      case 'fieldWithCustom': {
        if (!onCustomSelect) return null;
        const fieldItems = items as FieldDefinition[];
        const isPrepend = customDisplayMode === 'prepend';

        const getCustomActiveIndex = () => {
          if (isPrepend) {
            return activeIndex >= 0 && activeIndex < customItems.length ? activeIndex : -1;
          }
          return activeIndex >= fieldItems.length ? activeIndex - fieldItems.length : -1;
        };

        const getFieldActiveIndex = () => {
          if (isPrepend) {
            return activeIndex >= customItems.length ? activeIndex - customItems.length : -1;
          }
          return activeIndex >= 0 && activeIndex < fieldItems.length ? activeIndex : -1;
        };

        const handleCustomActiveChange = (idx: number) => {
          if (isPrepend) {
            handleActiveChange(idx);
          } else {
            handleActiveChange(idx + fieldItems.length);
          }
        };

        const handleFieldActiveChange = (idx: number) => {
          if (isPrepend) {
            handleActiveChange(idx + customItems.length);
          } else {
            handleActiveChange(idx);
          }
        };

        return (
          <>
            {isPrepend && customItems.length > 0 && (
              <>
                <CustomSuggestionList
                  items={customItems}
                  onSelect={onCustomSelect}
                  activeIndex={getCustomActiveIndex()}
                  onActiveChange={handleCustomActiveChange}
                  itemClassName={classNames?.suggestionItem}
                  descriptionClassName={classNames?.suggestionItemDescription}
                  hasMore={customHasMore}
                  isLoadingMore={customIsLoadingMore}
                  onLoadMore={onCustomLoadMore}
                  paginationLabels={paginationLabels}
                />
                {fieldItems.length > 0 && (
                  <div className={cn('tsi-divider', classNames?.divider)} />
                )}
              </>
            )}
            {fieldItems.length > 0 && (
              <FieldSuggestionList
                fields={fieldItems}
                onSelect={onFieldSelect}
                activeIndex={getFieldActiveIndex()}
                onActiveChange={handleFieldActiveChange}
                itemClassName={classNames?.suggestionItem}
                hintClassName={classNames?.suggestionItemHint}
                iconClassName={classNames?.suggestionItemIcon}
                categoryClassName={classNames?.fieldCategory}
              />
            )}
            {!isPrepend && customItems.length > 0 && (
              <>
                {fieldItems.length > 0 && (
                  <div className={cn('tsi-divider', classNames?.divider)} />
                )}
                <CustomSuggestionList
                  items={customItems}
                  onSelect={onCustomSelect}
                  activeIndex={getCustomActiveIndex()}
                  onActiveChange={handleCustomActiveChange}
                  itemClassName={classNames?.suggestionItem}
                  descriptionClassName={classNames?.suggestionItemDescription}
                  hasMore={customHasMore}
                  isLoadingMore={customIsLoadingMore}
                  onLoadMore={onCustomLoadMore}
                  paginationLabels={paginationLabels}
                />
              </>
            )}
          </>
        );
      }

      case 'date': {
        const dateFieldDef = currentFieldDef as DateFieldDefinition | undefined;
        if (!dateFieldDef) return null;

        const displayValue = syncedDate ?? dateValue;

        const datePickerProps: DatePickerRenderProps = {
          value: displayValue,
          onChange: handleDateChangeInternal,
          onClose: handleDateCloseInternal,
          fieldDef: dateFieldDef,
          restoreFocus,
          defaultMonth: displayValue ?? new Date(),
          confirmedValue: dateValue,
        };

        if (dateFieldDef.renderPicker) {
          return dateFieldDef.renderPicker(datePickerProps);
        }
        if (renderDatePicker) {
          return renderDatePicker(datePickerProps);
        }

        return <DefaultDatePicker {...datePickerProps} />;
      }

      case 'datetime': {
        const datetimeFieldDef = currentFieldDef as DateTimeFieldDefinition | undefined;
        if (!datetimeFieldDef) return null;

        const displayValueDt = syncedDate ?? dateValue;

        const datetimePickerProps: DateTimePickerRenderProps = {
          value: displayValueDt,
          onChange: handleDateChangeInternal,
          onClose: handleDateCloseInternal,
          fieldDef: datetimeFieldDef,
          timeControls: {
            isUTC: isUTC,
            onUTCChange: handleUTCChangeInternal,
            includeTime: includeTime,
            onIncludeTimeChange: handleIncludeTimeChangeInternal,
          },
          restoreFocus,
          defaultMonth: displayValueDt ?? new Date(),
          confirmedValue: dateValue,
        };

        if (datetimeFieldDef.renderPicker) {
          return datetimeFieldDef.renderPicker(datetimePickerProps);
        }
        if (renderDateTimePicker) {
          return renderDateTimePicker(datetimePickerProps);
        }

        return <DefaultDateTimePicker {...datetimePickerProps} />;
      }

      default:
        return null;
    }
  };

  const content = renderContent();
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
    >
      {content}
    </div>
  );
};
