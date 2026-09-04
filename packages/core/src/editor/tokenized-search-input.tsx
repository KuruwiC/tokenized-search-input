import Document from '@tiptap/extension-document';
import History from '@tiptap/extension-history';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import type { Transaction } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ClipboardSerializer } from '../extensions/clipboard-serializer';
import { EDITOR_CONTEXT_UPDATED, EditorContextExtension } from '../extensions/editor-context';
import { KeyboardShortcutsExtension } from '../extensions/keyboard-shortcuts';
import { SpacerNode } from '../extensions/spacer-node';
import { TokenNavigation } from '../extensions/token-navigation';
import { useIsomorphicLayoutEffect } from '../hooks/use-isomorphic-layout-effect';
import { usePluginState } from '../hooks/use-plugin-state';
import { createSelectionGuardPlugin } from '../plugins/selection-guard-plugin';
import {
  clearDismissed,
  createSuggestionPlugin,
  dismissSuggestion,
  getSuggestionState,
  setSuggestion,
  suggestionKey,
} from '../plugins/suggestion-plugin';
import {
  createTokenFocusPlugin,
  getTokenFocusState,
  tokenFocusKey,
} from '../plugins/token-focus-plugin';
import {
  SelectionInvariantExtension,
  TokenSpacingExtension,
} from '../plugins/token-spacing-plugin';
import { FORCE_VALIDATION_CHECK, ValidationExtension } from '../plugins/validation-plugin';
import { createQuerySnapshot, parseQueryToDoc, serializeDocToQuery } from '../serializer';
import { getDismissPolicy } from '../suggestions/dismiss-policy';
import { SuggestionOverlay } from '../suggestions/suggestion-overlay';
import { FilterTokenNode } from '../tokens/filter-token/filter-token-node';
import { FreeTextTokenNode } from '../tokens/free-text-token/free-text-token-node';
import { DEFAULT_TOKEN_DELIMITER, type FieldDefinition, type QuerySnapshot } from '../types';
import { cn } from '../utils/cn';
import { isWithinSuggestion } from '../utils/dom-focus';
import { isToken } from '../utils/node-predicates';
import { EMPTY_SNAPSHOT, getAllTokens } from '../utils/query-snapshot';
import {
  areTokenListsEqual,
  areTokenListsEqualExcludingFocused,
  type ComparableToken,
} from '../utils/token-events';
import { ClearButton } from './clear-button';
import { isEditorEmpty } from './editor-state';
import { useSuggestionHandlers } from './hooks/use-suggestion-handlers';
import { useCustomSuggestions } from './use-custom-suggestions';
import { useFieldSuggestions } from './use-field-suggestions';

export type {
  TokenizedSearchInputProps,
  TokenizedSearchInputRef,
} from './tokenized-search-input.types';

import type {
  TokenizedSearchInputProps,
  TokenizedSearchInputRef,
} from './tokenized-search-input.types';

export const TokenizedSearchInput = forwardRef<TokenizedSearchInputRef, TokenizedSearchInputProps>(
  function TokenizedSearchInput(
    {
      fields,
      defaultValue,
      onChange,
      onSubmit,
      onTokensChange,
      onBlur,
      onFocus,
      onClear,
      placeholder = 'Search...',
      disabled = false,
      freeTextMode = 'plain',
      clearable = false,
      className,
      classNames,
      singleLine = false,
      expandOnFocus = false,
      // Grouped config props
      suggestions = {},
      validation: validationConfig,
      unknownFields = {},
      serialization = {},
      initialDelimiter,
      labels = {},
      pickers = {},
      immediatelyRender = true,
      startAdornment,
      endAdornment,
    },
    ref
  ) {
    // Extract config values with defaults
    const allowUnknownFields = unknownFields.allow ?? false;
    const unknownFieldOperators = unknownFields.operators;
    const hideUnknownFieldSingleOperator = unknownFields.hideSingleOperator ?? false;
    const operatorLabels = labels.operators;
    const fieldSuggestionsDisabled = suggestions.field?.disabled ?? false;
    const fieldSuggestionMatcher = suggestions.field?.matcher;
    const valueSuggestionsDisabled = suggestions.value?.disabled ?? false;
    const validation = useMemo(
      () => (validationConfig?.rules ? { rules: validationConfig.rules } : undefined),
      [validationConfig?.rules]
    );
    const customSuggestionConfig = suggestions.custom;
    const serializeToken = serialization.serializeToken;
    const deserializeText = serialization.deserializeText;
    const renderDatePicker = pickers.renderDate;
    const renderDateTimePicker = pickers.renderDateTime;
    const paginationLabels = labels.pagination;

    const containerRef = useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const pointerDownInSuggestionRef = useRef(false);
    const instanceId = useId().replace(/:/g, '');
    const suggestionListId = `tsi-suggestions-${instanceId}`;
    const suggestionOptionIdPrefix = `tsi-suggestion-option-${instanceId}`;

    // Store initial delimiter value - cannot be changed after mount
    const delimiterValue = initialDelimiter ?? DEFAULT_TOKEN_DELIMITER;
    if (delimiterValue.length !== 1) {
      throw new Error(
        `[TokenizedSearchInput] initialDelimiter must be a single character, got "${delimiterValue}"`
      );
    }
    const delimiterRef = useRef(delimiterValue);

    // Track previous snapshot for onChange
    const prevSnapshotRef = useRef<QuerySnapshot>(EMPTY_SNAPSHOT);

    // Track confirmed (non-focused) tokens for onTokensChange
    // Only updated when onTokensChange fires
    const confirmedTokensRef = useRef<ComparableToken[]>([]);

    // Warn in development if delimiter prop changes after initialization
    useEffect(() => {
      if (process.env.NODE_ENV !== 'production') {
        const initial = delimiterRef.current;
        const current = initialDelimiter ?? DEFAULT_TOKEN_DELIMITER;
        if (current !== initial) {
          console.warn(
            '[TokenizedSearchInput] initialDelimiter changed after initialization. ' +
              'This has no effect. initialDelimiter is frozen at mount time.'
          );
        }
      }
    }, [initialDelimiter]);

    // Warn in development if any field has no operators
    useEffect(() => {
      if (process.env.NODE_ENV !== 'production') {
        fields.forEach((field) => {
          if (!field.operators || field.operators.length === 0) {
            console.warn(
              `[TokenizedSearchInput] Field "${field.key}" has no operators defined. ` +
                'At least one operator is required for proper functionality.'
            );
          }
        });
      }
    }, [fields]);

    // Warn in development if fields prop changes reference but content is the same
    const prevFieldsRef = useRef(fields);
    const fieldsRerenderCountRef = useRef(0);
    useEffect(() => {
      if (process.env.NODE_ENV !== 'production') {
        const keysEqual = (a: FieldDefinition[], b: FieldDefinition[]) =>
          a.map((f) => f.key).join(',') === b.map((f) => f.key).join(',');

        const isUnnecessaryRerender =
          fields !== prevFieldsRef.current && keysEqual(fields, prevFieldsRef.current);

        if (isUnnecessaryRerender && ++fieldsRerenderCountRef.current === 3) {
          console.warn(
            '[TokenizedSearchInput] fields prop changed reference but content is the same. ' +
              'Consider memoizing the fields array with useMemo() to avoid unnecessary re-renders.'
          );
        }
        prevFieldsRef.current = fields;
      }
    }, [fields]);

    // Extensions must stay stable: changing them recreates the TipTap editor,
    // which would discard content and history. Mutable configuration is kept
    // in EditorContextStorage and synchronized below.
    // biome-ignore lint/correctness/useExhaustiveDependencies: dynamic props are intentionally stored in editor context
    const extensions = useMemo(
      () => [
        Document,
        Paragraph,
        Text,
        History,
        SpacerNode,
        FilterTokenNode.configure({
          fields,
          unknownFieldOperators,
          delimiter: delimiterRef.current,
        }),
        FreeTextTokenNode.configure({ enabled: freeTextMode === 'tokenize' }),
        TokenNavigation,
        ClipboardSerializer.configure({ serializeToken, delimiter: delimiterRef.current }),
        ValidationExtension,
        TokenSpacingExtension,
        SelectionInvariantExtension,
        EditorContextExtension.configure({
          fields,
          freeTextMode,
          allowUnknownFields,
          unknownFieldOperators,
          hideUnknownFieldSingleOperator,
          operatorLabels,
          fieldSuggestionsDisabled,
          valueSuggestionsDisabled,
          validation,
          deserializeText,
          serializeToken,
          delimiter: delimiterRef.current,
          classNames,
        }),
        KeyboardShortcutsExtension,
      ],
      []
    );

    const editor = useEditor({
      immediatelyRender,
      extensions,
      content: defaultValue
        ? parseQueryToDoc(defaultValue, fields, {
            freeTextMode,
            allowUnknownFields,
            unknownFieldOperators,
            delimiter: delimiterRef.current,
          })
        : '',
      editable: !disabled,
      editorProps: {
        attributes: {
          'aria-label': 'Search query input',
          role: 'combobox',
          'aria-haspopup': 'listbox',
        },
        // Touch/pointer events flow to ProseMirror (not blocked by stopEvent).
        // Browser synthesizes click from touch, which is handled by React onClick.
      },
      onCreate: ({ editor: ed }) => {
        const focusPlugin = createTokenFocusPlugin();
        const suggestionPlugin = createSuggestionPlugin();
        const selectionGuardPlugin = createSelectionGuardPlugin();
        ed.view.updateState(
          ed.view.state.reconfigure({
            plugins: [
              ...ed.view.state.plugins,
              focusPlugin,
              suggestionPlugin,
              selectionGuardPlugin,
            ],
          })
        );

        // Set initial suggestion disabled states and force validation check
        // IMPORTANT: Use ed.view.state.tr (not ed.state.tr) because plugins were added to view.state
        const tr = ed.view.state.tr;
        setSuggestion(tr, {
          fieldSuggestionsDisabled,
          valueSuggestionsDisabled,
        });
        tr.setMeta(FORCE_VALIDATION_CHECK, true);
        ed.view.dispatch(tr);
      },
      onUpdate: ({ editor: ed }) => {
        const snapshot = createQuerySnapshot(ed.getJSON(), { delimiter: delimiterRef.current });

        // Detect changes in confirmed (non-focused) filter tokens for onTokensChange
        if (onTokensChange) {
          const focusState = getTokenFocusState(ed.view.state);
          const focusedPos = focusState?.focusedPos ?? null;

          // Get focused token ID from node attrs
          let focusedTokenId: string | null = null;
          if (focusedPos !== null) {
            const node = ed.view.state.doc.nodeAt(focusedPos);
            if (node && isToken(node)) {
              focusedTokenId = (node.attrs as { id?: string }).id ?? null;
            }
          }

          const currentTokens = getAllTokens(snapshot);

          // Compare excluding focused token from BOTH lists
          // confirmedTokensRef always stores all tokens (unfiltered)
          // Filtering is applied during comparison only
          const isEqual = areTokenListsEqualExcludingFocused(
            confirmedTokensRef.current,
            currentTokens,
            focusedTokenId
          );

          if (!isEqual) {
            onTokensChange(snapshot);
            // Store all tokens (unfiltered) for next comparison
            confirmedTokensRef.current = currentTokens;
          }
        }

        prevSnapshotRef.current = snapshot;
        onChange?.(snapshot);
        setIsEmpty(isEditorEmpty(ed));
      },
      onTransaction: ({ editor: ed, transaction }) => {
        // Handle onTokensChange when focus leaves a token
        // onUpdate only fires on doc changes, but we need to detect focus changes too
        if (!onTokensChange) return;

        // Check if this transaction changed focusedPos to null
        const meta = transaction.getMeta(tokenFocusKey);
        if (!meta || meta.focusedPos !== null) return;

        // Skip if doc changed - onUpdate will handle it
        // This prevents double snapshot creation and ensures consistent behavior
        if (transaction.docChanged) return;

        // Focus is leaving a token without doc change - check for changes
        // Reuse prevSnapshotRef to avoid redundant snapshot creation
        const snapshot =
          prevSnapshotRef.current ??
          createQuerySnapshot(ed.getJSON(), { delimiter: delimiterRef.current });
        const currentTokens = getAllTokens(snapshot);

        // Compare full lists (no exclusion since focus is leaving)
        const isEqual = areTokenListsEqual(confirmedTokensRef.current, currentTokens);

        if (!isEqual) {
          onTokensChange(snapshot);
          confirmedTokensRef.current = currentTokens;
        }
      },
    });

    // Sync isEmpty state when editor becomes available
    // useIsomorphicLayoutEffect runs before paint on client, preventing placeholder flash
    // Falls back to useEffect on server for SSR compatibility
    useIsomorphicLayoutEffect(() => {
      if (!editor) return;
      setIsEmpty(isEditorEmpty(editor));
    }, [editor]);

    // Subscribe to suggestion state for ARIA
    const suggestionState = usePluginState(editor, suggestionKey);
    const isSuggestionOpen =
      suggestionState && suggestionState.type !== null && !suggestionState.dismissed;

    // Dynamic combobox relationships must live on ProseMirror's actual
    // contenteditable element, rather than EditorContent's wrapper.
    useEffect(() => {
      if (!editor) return;
      const input = editor.view.dom;
      const popupRole =
        suggestionState?.type === 'date' || suggestionState?.type === 'datetime'
          ? 'dialog'
          : 'listbox';
      input.setAttribute('aria-expanded', isSuggestionOpen ? 'true' : 'false');
      input.setAttribute('aria-haspopup', popupRole);
      if (isSuggestionOpen) {
        input.setAttribute('aria-controls', suggestionListId);
      } else {
        input.removeAttribute('aria-controls');
      }
      const activeIndex = suggestionState?.activeIndex ?? -1;
      const hasActiveOption = activeIndex >= 0 && isSuggestionOpen && popupRole === 'listbox';
      if (hasActiveOption) {
        input.setAttribute('aria-activedescendant', `${suggestionOptionIdPrefix}-${activeIndex}`);
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }, [
      editor,
      isSuggestionOpen,
      suggestionState?.activeIndex,
      suggestionState?.type,
      suggestionListId,
      suggestionOptionIdPrefix,
    ]);

    // Update EditorContext when props change
    useEffect(() => {
      if (!editor) return;
      editor.commands.setEditorContext({
        fields,
        freeTextMode,
        allowUnknownFields,
        unknownFieldOperators,
        hideUnknownFieldSingleOperator,
        operatorLabels,
        fieldSuggestionsDisabled,
        valueSuggestionsDisabled,
        validation,
        deserializeText,
        serializeToken,
        classNames,
      });
      editor.view.dispatch(
        editor.state.tr.setMeta('addToHistory', false).setMeta(EDITOR_CONTEXT_UPDATED, true)
      );
    }, [
      editor,
      fields,
      freeTextMode,
      allowUnknownFields,
      unknownFieldOperators,
      hideUnknownFieldSingleOperator,
      operatorLabels,
      fieldSuggestionsDisabled,
      valueSuggestionsDisabled,
      validation,
      deserializeText,
      serializeToken,
      classNames,
    ]);

    // Update plugin state when suggestion disabled props change
    useEffect(() => {
      if (!editor) return;

      // Skip if suggestion plugin hasn't been registered yet (will be set in onCreate)
      const suggestionState = getSuggestionState(editor.view.state);
      if (!suggestionState) return;

      const tr = editor.view.state.tr;
      setSuggestion(tr, {
        fieldSuggestionsDisabled,
        valueSuggestionsDisabled,
      });
      editor.view.dispatch(tr);
    }, [editor, fieldSuggestionsDisabled, valueSuggestionsDisabled]);

    // Sync disabled state with editor.isEditable and aria-disabled
    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!disabled);
      editor.setOptions({
        editorProps: {
          attributes: {
            'aria-label': 'Search query input',
            role: 'combobox',
            'aria-haspopup': 'listbox',
            ...(disabled ? { 'aria-disabled': 'true' } : {}),
          },
        },
      });
    }, [editor, disabled]);

    // Re-validate when validation config changes
    const prevValidationRef = useRef(validation);
    useEffect(() => {
      if (!editor) return;
      const prevValidation = prevValidationRef.current;
      prevValidationRef.current = validation;

      // Skip if validation hasn't changed (referential equality check is sufficient)
      if (prevValidation === validation) return;

      // Trigger re-validation
      const tr = editor.state.tr;
      tr.setMeta(FORCE_VALIDATION_CHECK, true);
      editor.view.dispatch(tr);
    }, [editor, validation]);

    // Re-parse content when freeTextMode changes
    const prevFreeTextModeRef = useRef(freeTextMode);
    useEffect(() => {
      if (!editor) return;
      const prevMode = prevFreeTextModeRef.current;
      prevFreeTextModeRef.current = freeTextMode;

      if (prevMode === freeTextMode) return;

      const currentQuery = serializeDocToQuery(editor.getJSON(), {
        delimiter: delimiterRef.current,
      });
      if (!currentQuery) return;

      const newDoc = parseQueryToDoc(currentQuery, fields, {
        freeTextMode,
        allowUnknownFields,
        unknownFieldOperators,
        delimiter: delimiterRef.current,
      });
      editor.commands.setContent(newDoc);
    }, [editor, freeTextMode, fields, allowUnknownFields, unknownFieldOperators]);

    // Field suggestions handling
    const { handleFieldSelect, updateSuggestions } = useFieldSuggestions(editor, fields, {
      matcher: fieldSuggestionMatcher,
    });

    // Custom suggestions handling
    const {
      handleCustomSelect,
      updateCustomSuggestions,
      hasMore: customHasMore,
      isLoadingMore: customIsLoadingMore,
      loadMore: onCustomLoadMore,
    } = useCustomSuggestions(editor, fields, customSuggestionConfig);

    // Value/date suggestion handlers
    const { handleValueSelect, handleDateChange, handleDateClose } = useSuggestionHandlers({
      editor,
      fields,
      updateSuggestions,
    });

    // Handle focus/blur at container level using focusout (bubbles from all children)
    // This catches blur from both ProseMirror and token value inputs
    // Reference: https://danburzo.ro/focus-within/
    useEffect(() => {
      if (!editor) return;
      const container = containerRef.current;
      if (!container) return;

      const handleContainerFocusOut = (e: FocusEvent) => {
        // Skip if pointerdown was in suggestion (user is clicking a suggestion item)
        if (pointerDownInSuggestionRef.current) {
          pointerDownInSuggestionRef.current = false;
          return;
        }

        const relatedTarget = e.relatedTarget as Element | null;

        // If focus is moving within the container, not a real blur
        if (relatedTarget && container.contains(relatedTarget)) {
          return;
        }

        // If focus is moving to suggestion overlay (outside container but part of UI)
        if (isWithinSuggestion(relatedTarget)) {
          return;
        }

        // Check if current suggestion type should dismiss on blur
        const suggestionState = getSuggestionState(editor.state);
        if (suggestionState?.type) {
          const policy = getDismissPolicy(suggestionState.type);
          if (!policy.dismissOnBlur) {
            return;
          }
        }

        // Focus is leaving the container - process blur
        setIsInputFocused(false);
        editor.commands.finalizeInput();

        if (onBlur) {
          const snapshot = createQuerySnapshot(editor.getJSON(), {
            delimiter: delimiterRef.current,
          });
          onBlur(snapshot);
        }

        const tr = editor.state.tr;
        dismissSuggestion(tr);
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
      };

      const handleContainerFocusIn = () => {
        // Only trigger on first focus into the container
        if (isInputFocused) return;

        setIsInputFocused(true);

        if (onFocus) {
          const snapshot = createQuerySnapshot(editor.getJSON(), {
            delimiter: delimiterRef.current,
          });
          onFocus(snapshot);
        }

        const tr = editor.state.tr;
        clearDismissed(tr);
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
        updateSuggestions();
        updateCustomSuggestions();
      };

      container.addEventListener('focusout', handleContainerFocusOut);
      container.addEventListener('focusin', handleContainerFocusIn);

      return () => {
        container.removeEventListener('focusout', handleContainerFocusOut);
        container.removeEventListener('focusin', handleContainerFocusIn);
      };
    }, [editor, updateSuggestions, updateCustomSuggestions, onBlur, onFocus, isInputFocused]);

    // Handle outside clicks to dismiss suggestions
    useEffect(() => {
      if (!editor) return;

      const handlePointerDown = (e: PointerEvent) => {
        const target = e.target as Node;

        // Check if click is inside this editor's suggestion overlay
        const suggestionRoot = containerRef.current?.querySelector('[data-suggestion-root]');
        if (suggestionRoot?.contains(target)) {
          pointerDownInSuggestionRef.current = true;
          return;
        }

        // Check if click is inside editor container
        if (containerRef.current?.contains(target)) {
          return;
        }

        // Click is outside - dismiss suggestions
        const tr = editor.state.tr;
        dismissSuggestion(tr);
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
      };

      document.addEventListener('pointerdown', handlePointerDown, true);

      return () => {
        document.removeEventListener('pointerdown', handlePointerDown, true);
      };
    }, [editor]);

    // Store update functions in refs to avoid useEffect re-execution on function changes
    const updateSuggestionsRef = useRef(updateSuggestions);
    const updateCustomSuggestionsRef = useRef(updateCustomSuggestions);
    useEffect(() => {
      updateSuggestionsRef.current = updateSuggestions;
      updateCustomSuggestionsRef.current = updateCustomSuggestions;
    });

    // RAF ID stored in ref to persist across useEffect dependencies updates
    const rafIdRef = useRef<number | null>(null);

    // Update suggestions on selection/update changes
    useEffect(() => {
      if (!editor) return;

      const debouncedUpdate = () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = requestAnimationFrame(() => {
          updateSuggestionsRef.current();
          updateCustomSuggestionsRef.current();
          rafIdRef.current = null;
        });
      };

      const handleSelectionUpdate = () => {
        debouncedUpdate();

        // Scroll cursor into view in collapsed state only
        if (singleLine || (expandOnFocus && !isInputFocused)) {
          try {
            const domAtPos = editor.view.domAtPos(editor.state.selection.from);
            // domAtPos.node may be a text node, so get the parent element if needed
            const element =
              domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement;
            element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          } catch {
            // Ignore errors when position is not in DOM
          }
        }
      };

      const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
        if (transaction.getMeta('exitingToken')) {
          requestAnimationFrame(() => {
            updateSuggestionsRef.current();
            updateCustomSuggestionsRef.current();
          });
        }
      };

      editor.on('selectionUpdate', handleSelectionUpdate);
      editor.on('update', debouncedUpdate);
      editor.on('transaction', handleTransaction);

      return () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        editor.off('selectionUpdate', handleSelectionUpdate);
        editor.off('update', debouncedUpdate);
        editor.off('transaction', handleTransaction);
      };
    }, [editor, singleLine, expandOnFocus, isInputFocused]);

    // Submit execution
    const handleSubmit = useCallback(() => {
      if (!editor) return;
      const snapshot = createQuerySnapshot(editor.getJSON(), { delimiter: delimiterRef.current });
      onSubmit?.(snapshot);
    }, [editor, onSubmit]);

    // Update callbacks in EditorContextExtension
    useEffect(() => {
      if (!editor) return;
      editor.commands.setCallbacks({
        onFieldSelect: handleFieldSelect,
        onValueSelect: handleValueSelect,
        onCustomSelect: handleCustomSelect,
        onSubmit: handleSubmit,
      });
    }, [editor, handleFieldSelect, handleValueSelect, handleCustomSelect, handleSubmit]);

    // Imperative handle
    useImperativeHandle(
      ref,
      () => ({
        setValue: (value: string) => {
          if (!editor) return;
          editor.commands.setContent(
            parseQueryToDoc(value, fields, {
              freeTextMode,
              allowUnknownFields,
              unknownFieldOperators,
              delimiter: delimiterRef.current,
            })
          );
          // Trigger validation after programmatic content change
          const tr = editor.state.tr;
          tr.setMeta(FORCE_VALIDATION_CHECK, true);
          editor.view.dispatch(tr);
        },
        getValue: () => {
          if (!editor) return '';
          return serializeDocToQuery(editor.getJSON(), { delimiter: delimiterRef.current });
        },
        getSnapshot: () => {
          if (!editor) return { segments: [], text: '' };
          return createQuerySnapshot(editor.getJSON(), { delimiter: delimiterRef.current });
        },
        focus: () => {
          editor?.commands.focus();
        },
        clear: () => {
          editor?.commands.clearContent();
        },
        submit: handleSubmit,
        // Internal access - not part of public API
        _getInternalEditor: () => editor,
      }),
      [
        editor,
        fields,
        freeTextMode,
        allowUnknownFields,
        unknownFieldOperators,
        handleSubmit,
        // Note: delimiterRef.current is intentionally not in deps - it never changes after mount
      ]
    );

    const containerElement = (
      <div
        ref={containerRef}
        aria-disabled={disabled || undefined}
        className={cn(
          'tsi-container',
          expandOnFocus && 'tsi-container--expand-on-focus',
          clearable && (singleLine || expandOnFocus) && 'tsi-container--clearable',
          (singleLine || expandOnFocus) && 'tsi-container--flex',
          startAdornment && 'tsi-container--has-start-adornment',
          endAdornment && 'tsi-container--has-end-adornment',
          !expandOnFocus && classNames?.root,
          !expandOnFocus && className
        )}
      >
        {startAdornment && (
          <div className={cn('tsi-adornment', 'tsi-adornment--start', classNames?.startAdornment)}>
            {startAdornment}
          </div>
        )}

        <EditorContent
          editor={editor}
          className={cn(
            'tsi-input',
            singleLine && !expandOnFocus && 'tsi-input--single-line',
            expandOnFocus && 'tsi-input--expand-on-focus',
            singleLine || expandOnFocus ? 'tsi-input--flex-child' : 'tsi-input--full-width',
            clearable && !singleLine && !expandOnFocus ? 'tsi-input--clear-pad' : '',
            disabled ? 'tsi-input--disabled' : '',
            classNames?.input
          )}
        />

        {(clearable || endAdornment) && (
          <div className="tsi-end-controls">
            {clearable && (
              <ClearButton
                onClick={() => {
                  editor?.commands.clearContent();
                  onClear?.();
                }}
                visible={!isEmpty}
                disabled={disabled}
                className={classNames?.clearButton}
                inline={singleLine || expandOnFocus}
              />
            )}

            {clearable && endAdornment && !isEmpty && (
              <div className="tsi-adornment-separator" aria-hidden="true" />
            )}

            {endAdornment && (
              <div className={cn('tsi-adornment', 'tsi-adornment--end', classNames?.endAdornment)}>
                {endAdornment}
              </div>
            )}
          </div>
        )}

        {isEmpty && (
          <div className={cn('tsi-placeholder', classNames?.placeholder)} aria-hidden="true">
            {placeholder}
          </div>
        )}

        {editor && (
          <SuggestionOverlay
            editor={editor}
            containerRef={containerRef}
            fields={fields}
            onFieldSelect={handleFieldSelect}
            onValueSelect={handleValueSelect}
            onCustomSelect={handleCustomSelect}
            onDateChange={handleDateChange}
            onDateClose={handleDateClose}
            classNames={classNames}
            customHasMore={customHasMore}
            customIsLoadingMore={customIsLoadingMore}
            onCustomLoadMore={onCustomLoadMore}
            expandOnFocus={expandOnFocus}
            renderDatePicker={renderDatePicker}
            renderDateTimePicker={renderDateTimePicker}
            paginationLabels={paginationLabels}
            listboxId={suggestionListId}
            optionIdPrefix={suggestionOptionIdPrefix}
          />
        )}
      </div>
    );

    // Wrap in relative container for expandOnFocus mode
    // This ensures the absolute-positioned container stays within bounds
    // Also maintains min-height to prevent layout shift when container becomes absolute
    if (expandOnFocus) {
      return (
        <div className={cn('tsi-wrapper--expand-on-focus', classNames?.root, className)}>
          {containerElement}
        </div>
      );
    }

    return containerElement;
  }
);

export default TokenizedSearchInput;
