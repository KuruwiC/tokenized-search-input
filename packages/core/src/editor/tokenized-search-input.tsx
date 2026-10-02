import type { JSONContent } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import History from '@tiptap/extension-history';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import type { Transaction } from '@tiptap/pm/state';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
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
import { CorePluginsExtension } from '../extensions/core-plugins';
import {
  createEditorContext,
  EDITOR_CONTEXT_UPDATED,
  EditorContextExtension,
  getEditorContext,
} from '../extensions/editor-context';
import { KeyboardShortcutsExtension } from '../extensions/keyboard-shortcuts';
import { SpacerNode } from '../extensions/spacer-node';
import { TokenNavigation } from '../extensions/token-navigation';
import { useDevWarnings } from '../hooks/use-dev-warnings';
import { useIsomorphicLayoutEffect } from '../hooks/use-isomorphic-layout-effect';
import { usePluginState } from '../hooks/use-plugin-state';
import {
  clearDismissed,
  dismissSuggestion,
  getSuggestionState,
  suggestionKey,
} from '../plugins/suggestion-plugin';
import { getTokenFocusState, tokenFocusKey } from '../plugins/token-focus-plugin';
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
import type { QuerySnapshot, UnknownFieldTemplate } from '../types';
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
  TokenDisplay,
  TokenizedSearchInputProps,
  TokenizedSearchInputRef,
  TokenPatch,
} from './tokenized-search-input.types';

import {
  deleteTokenInDoc,
  deleteTokenInEditor,
  setTokenDisplayInDoc,
  setTokenDisplayInEditor,
  updateTokenInDoc,
  updateTokenInEditor,
} from './token-commands';
import type {
  TokenDisplay,
  TokenizedSearchInputProps,
  TokenizedSearchInputRef,
  TokenPatch,
} from './tokenized-search-input.types';

function setContentAndValidate(editor: Editor, doc: JSONContent): void {
  editor.commands.setContent(doc);
  // Trigger validation after programmatic content change
  const tr = editor.state.tr;
  tr.setMeta(FORCE_VALIDATION_CHECK, true);
  editor.view.dispatch(tr);
}

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
      unknownFields,
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
    const hasUnknownFields = unknownFields !== undefined;
    const unknownOperators = unknownFields?.operators;
    const unknownHideSingleOperator = unknownFields?.hideSingleOperator;
    const unknownAllowSpaces = unknownFields?.allowSpaces;
    const unknownValidate = unknownFields?.validate;
    const unknownSanitize = unknownFields?.sanitize;
    // Rebuilt only when a member changes so an inline `unknownFields={{ ... }}`
    // does not re-sync the editor context on every render.
    const unknownFieldTemplate = useMemo<UnknownFieldTemplate | undefined>(
      () =>
        hasUnknownFields
          ? {
              operators: unknownOperators,
              hideSingleOperator: unknownHideSingleOperator,
              allowSpaces: unknownAllowSpaces,
              validate: unknownValidate,
              sanitize: unknownSanitize,
            }
          : undefined,
      [
        hasUnknownFields,
        unknownOperators,
        unknownHideSingleOperator,
        unknownAllowSpaces,
        unknownValidate,
        unknownSanitize,
      ]
    );
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

    // Track previous snapshot for onChange
    const prevSnapshotRef = useRef<QuerySnapshot>(EMPTY_SNAPSHOT);

    // Track confirmed (non-focused) tokens for onTokensChange
    // Only updated when onTokensChange fires
    const confirmedTokensRef = useRef<ComparableToken[]>([]);

    useDevWarnings({ fields, initialDelimiter, defaultValue });

    // Mount-time configuration. Extensions must stay stable: changing them
    // recreates the TipTap editor, which would discard content and history. The
    // editor context storage seeded here is the single owner of configuration and
    // is kept current by the sync effect below.
    const [initialContext] = useState(() =>
      createEditorContext({
        fields,
        freeTextMode,
        unknownFields: unknownFieldTemplate,
        operatorLabels,
        fieldSuggestionsDisabled,
        valueSuggestionsDisabled,
        validation,
        deserializeText,
        serializeToken,
        delimiter: initialDelimiter,
        classNames,
        renderDatePicker,
        renderDateTimePicker,
        paginationLabels,
      })
    );
    const [extensions] = useState(() => [
      Document,
      Paragraph,
      Text,
      History,
      SpacerNode,
      FilterTokenNode,
      FreeTextTokenNode,
      TokenNavigation,
      ClipboardSerializer,
      ValidationExtension,
      TokenSpacingExtension,
      SelectionInvariantExtension,
      EditorContextExtension.configure(initialContext),
      KeyboardShortcutsExtension,
      CorePluginsExtension,
    ]);

    const editor = useEditor({
      immediatelyRender,
      extensions,
      content: defaultValue
        ? parseQueryToDoc(defaultValue, initialContext.fields, {
            freeTextMode: initialContext.freeTextMode,
            unknownFields: initialContext.unknownFields,
            delimiter: initialContext.delimiter,
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
        const tr = ed.state.tr;
        tr.setMeta(FORCE_VALIDATION_CHECK, true);
        ed.view.dispatch(tr);
      },
      onUpdate: ({ editor: ed }) => {
        const snapshot = createQuerySnapshot(ed.getJSON(), {
          delimiter: getEditorContext(ed).delimiter,
        });

        // Detect changes in confirmed (non-focused) filter tokens for onTokensChange
        if (onTokensChange) {
          const focusState = getTokenFocusState(ed.state);
          const focusedPos = focusState?.focusedPos ?? null;

          // Get focused token ID from node attrs
          let focusedTokenId: string | null = null;
          if (focusedPos !== null) {
            const node = ed.state.doc.nodeAt(focusedPos);
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
          createQuerySnapshot(ed.getJSON(), { delimiter: getEditorContext(ed).delimiter });
        const currentTokens = getAllTokens(snapshot);

        // Compare full lists (no exclusion since focus is leaving)
        const isEqual = areTokenListsEqual(confirmedTokensRef.current, currentTokens);

        if (!isEqual) {
          onTokensChange(snapshot);
          confirmedTokensRef.current = currentTokens;
        }
      },
    });

    // Effects below skip a destroyed editor. useEditor destroys an instance whose
    // render is not committed within a tick, which happens when React 19 commits a
    // Suspense-prerendered tree late. The commit then still sees that instance, and
    // useEditor re-renders with a fresh one right after.

    // Sync isEmpty state when editor becomes available
    // useIsomorphicLayoutEffect runs before paint on client, preventing placeholder flash
    // Falls back to useEffect on server for SSR compatibility
    useIsomorphicLayoutEffect(() => {
      if (!editor || editor.isDestroyed) return;
      setIsEmpty(isEditorEmpty(editor));
    }, [editor]);

    // Subscribe to suggestion state for ARIA
    const suggestionState = usePluginState(editor, suggestionKey);
    const isSuggestionOpen =
      suggestionState && suggestionState.type !== null && !suggestionState.dismissed;

    // Dynamic combobox relationships must live on ProseMirror's actual
    // contenteditable element, rather than EditorContent's wrapper.
    useEffect(() => {
      if (!editor || editor.isDestroyed) return;
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
      if (!editor || editor.isDestroyed) return;
      editor.commands.setEditorContext({
        fields,
        freeTextMode,
        unknownFields: unknownFieldTemplate,
        operatorLabels,
        fieldSuggestionsDisabled,
        valueSuggestionsDisabled,
        validation,
        deserializeText,
        serializeToken,
        classNames,
        renderDatePicker,
        renderDateTimePicker,
        paginationLabels,
      });
      editor.view.dispatch(
        editor.state.tr.setMeta('addToHistory', false).setMeta(EDITOR_CONTEXT_UPDATED, true)
      );
    }, [
      editor,
      fields,
      freeTextMode,
      unknownFieldTemplate,
      operatorLabels,
      fieldSuggestionsDisabled,
      valueSuggestionsDisabled,
      validation,
      deserializeText,
      serializeToken,
      classNames,
      renderDatePicker,
      renderDateTimePicker,
      paginationLabels,
    ]);

    // Sync disabled state with editor.isEditable and aria-disabled
    useEffect(() => {
      if (!editor || editor.isDestroyed) return;
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
      if (!editor || editor.isDestroyed) return;
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
      if (!editor || editor.isDestroyed) return;
      const prevMode = prevFreeTextModeRef.current;
      prevFreeTextModeRef.current = freeTextMode;

      if (prevMode === freeTextMode) return;

      const context = getEditorContext(editor);
      const currentQuery = serializeDocToQuery(editor.getJSON(), { delimiter: context.delimiter });
      if (!currentQuery) return;

      const newDoc = parseQueryToDoc(currentQuery, context.fields, {
        freeTextMode: context.freeTextMode,
        unknownFields: context.unknownFields,
        delimiter: context.delimiter,
      });
      editor.commands.setContent(newDoc);
    }, [editor, freeTextMode]);

    // Field suggestions handling
    const { handleFieldSelect, updateSuggestions } = useFieldSuggestions(editor, {
      matcher: fieldSuggestionMatcher,
    });

    // Custom suggestions handling
    const {
      handleCustomSelect,
      updateCustomSuggestions,
      hasMore: customHasMore,
      isLoadingMore: customIsLoadingMore,
      loadMore: onCustomLoadMore,
    } = useCustomSuggestions(editor, customSuggestionConfig);

    // Value/date suggestion handlers
    const { handleValueSelect, handleDateChange, handleDateClose } = useSuggestionHandlers({
      editor,
      updateSuggestions,
    });

    // Handle focus/blur at container level using focusout (bubbles from all children)
    // This catches blur from both ProseMirror and token value inputs
    // Reference: https://danburzo.ro/focus-within/
    useEffect(() => {
      if (!editor || editor.isDestroyed) return;
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
            delimiter: getEditorContext(editor).delimiter,
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
            delimiter: getEditorContext(editor).delimiter,
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
      if (!editor || editor.isDestroyed) return;

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
      if (!editor || editor.isDestroyed) return;

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

    // An ancestor's effect in the same commit can call the handle while `editor` is
    // still the destroyed instance. Writes made then are held here, read back by the
    // handle, and applied once the live editor renders.
    const pendingHandleRef = useRef<{ doc: JSONContent | null; focus: boolean }>({
      doc: null,
      focus: false,
    });
    useEffect(() => {
      if (!editor || editor.isDestroyed) return;
      const { doc, focus } = pendingHandleRef.current;
      pendingHandleRef.current = { doc: null, focus: false };
      if (doc) setContentAndValidate(editor, doc);
      if (focus) editor.commands.focus();
    }, [editor]);

    // Submit execution
    const handleSubmit = useCallback(() => {
      if (!editor) return;
      const doc = pendingHandleRef.current.doc ?? editor.getJSON();
      const snapshot = createQuerySnapshot(doc, { delimiter: getEditorContext(editor).delimiter });
      onSubmit?.(snapshot);
    }, [editor, onSubmit]);

    // Update callbacks in EditorContextExtension
    useEffect(() => {
      if (!editor || editor.isDestroyed) return;
      editor.commands.setCallbacks({
        onFieldSelect: handleFieldSelect,
        onValueSelect: handleValueSelect,
        onCustomSelect: handleCustomSelect,
        onSubmit: handleSubmit,
      });
    }, [editor, handleFieldSelect, handleValueSelect, handleCustomSelect, handleSubmit]);

    // Imperative handle
    useImperativeHandle(ref, () => {
      const parseValue = (ed: Editor, value: string) => {
        const context = getEditorContext(ed);
        return parseQueryToDoc(value, context.fields, {
          freeTextMode: context.freeTextMode,
          unknownFields: context.unknownFields,
          delimiter: context.delimiter,
        });
      };
      const readDoc = (ed: Editor) => pendingHandleRef.current.doc ?? ed.getJSON();

      return {
        setValue: (value: string) => {
          if (!editor) return;
          const doc = parseValue(editor, value);
          if (editor.isDestroyed) {
            pendingHandleRef.current.doc = doc;
            return;
          }
          setContentAndValidate(editor, doc);
        },
        getValue: () => {
          if (!editor) return '';
          return serializeDocToQuery(readDoc(editor), {
            delimiter: getEditorContext(editor).delimiter,
          });
        },
        getSnapshot: () => {
          if (!editor) return { segments: [], text: '' };
          return createQuerySnapshot(readDoc(editor), {
            delimiter: getEditorContext(editor).delimiter,
          });
        },
        focus: () => {
          if (!editor) return;
          if (editor.isDestroyed) {
            pendingHandleRef.current.focus = true;
            return;
          }
          editor.commands.focus();
        },
        clear: () => {
          if (!editor) return;
          if (editor.isDestroyed) {
            pendingHandleRef.current.doc = parseValue(editor, '');
            return;
          }
          editor.commands.clearContent();
        },
        submit: handleSubmit,
        updateToken: (id: string, patch: TokenPatch) => {
          if (!editor) return;
          if (editor.isDestroyed) {
            pendingHandleRef.current.doc = updateTokenInDoc(readDoc(editor), id, patch);
            return;
          }
          updateTokenInEditor(editor, id, patch);
        },
        deleteToken: (id: string) => {
          if (!editor) return;
          if (editor.isDestroyed) {
            pendingHandleRef.current.doc = deleteTokenInDoc(readDoc(editor), id);
            return;
          }
          deleteTokenInEditor(editor, id);
        },
        setTokenDisplay: (id: string, display: TokenDisplay) => {
          if (!editor) return;
          if (editor.isDestroyed) {
            pendingHandleRef.current.doc = setTokenDisplayInDoc(readDoc(editor), id, display);
            return;
          }
          setTokenDisplayInEditor(editor, id, display);
        },
        getEditor: () => editor,
      };
    }, [editor, handleSubmit]);

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
          endAdornment && 'tsi-container--has-end-adornment'
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
            onFieldSelect={handleFieldSelect}
            onValueSelect={handleValueSelect}
            onCustomSelect={handleCustomSelect}
            onDateChange={handleDateChange}
            onDateClose={handleDateClose}
            customHasMore={customHasMore}
            customIsLoadingMore={customIsLoadingMore}
            onCustomLoadMore={onCustomLoadMore}
            expandOnFocus={expandOnFocus}
            listboxId={suggestionListId}
            optionIdPrefix={suggestionOptionIdPrefix}
          />
        )}
      </div>
    );

    // The root element is the same in every mode and carries className and
    // classNames.root. With expandOnFocus the container leaves the flow on focus, so
    // the root also reserves its collapsed height to keep the layout from shifting.
    return (
      <div
        className={cn(
          'tsi-root',
          expandOnFocus && 'tsi-root--expand-on-focus',
          classNames?.root,
          className
        )}
      >
        {containerElement}
      </div>
    );
  }
);

export default TokenizedSearchInput;
