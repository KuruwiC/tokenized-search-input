import { EditorContent } from '@tiptap/react';
import { forwardRef, useCallback, useId, useRef } from 'react';
import { useDevWarnings } from '../hooks/use-dev-warnings';
import { SuggestionOverlay } from '../suggestions/suggestion-overlay';
import type { QuerySnapshot } from '../types';
import { cn } from '../utils/cn';
import { ClearButton } from './clear-button';
import { useCustomSuggestions } from './hooks/use-custom-suggestions';
import { useEditorConfig } from './hooks/use-editor-config';
import { useEditorConfigSync } from './hooks/use-editor-config-sync';
import { useEditorSetup } from './hooks/use-editor-setup';
import { useFieldSuggestions } from './hooks/use-field-suggestions';
import { useFocusWiring } from './hooks/use-focus-wiring';
import { useSuggestionHandlers } from './hooks/use-suggestion-handlers';
import { useSuggestionScheduling } from './hooks/use-suggestion-scheduling';
import {
  useRunHeldHandleCalls,
  useTokenizedSearchInputRef,
} from './hooks/use-tokenized-search-input-ref';
import { SuggestionAria } from './suggestion-aria';
import type {
  TokenizedSearchInputProps,
  TokenizedSearchInputRef,
} from './tokenized-search-input.types';

export type {
  TokenDisplay,
  TokenizedSearchInputProps,
  TokenizedSearchInputRef,
} from './tokenized-search-input.types';

export const TokenizedSearchInput = forwardRef<TokenizedSearchInputRef, TokenizedSearchInputProps>(
  function TokenizedSearchInputImpl(props, ref) {
    const {
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
      clearable = false,
      className,
      classNames,
      singleLine = false,
      expandOnFocus = false,
      suggestions,
      initialDelimiter,
      immediatelyRender = true,
      startAdornment,
      endAdornment,
    } = props;

    const config = useEditorConfig(props);
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceId = useId().replace(/:/g, '');
    const suggestionListId = `tsi-suggestions-${instanceId}`;
    const suggestionOptionIdPrefix = `tsi-suggestion-option-${instanceId}`;

    useDevWarnings({ fields, initialDelimiter, defaultValue });

    const { editor, isEmpty } = useEditorSetup({
      config,
      initialDelimiter,
      defaultValue,
      disabled,
      immediatelyRender,
      onChange,
      onTokensChange,
    });

    const { handleFieldSelect, updateSuggestions } = useFieldSuggestions(editor, {
      matcher: suggestions?.field?.matcher,
    });
    const {
      handleCustomSelect,
      updateCustomSuggestions,
      loadMore: onCustomLoadMore,
    } = useCustomSuggestions(editor, suggestions?.custom);
    const { handleValueSelect, handleDateChange, handleDateClose } = useSuggestionHandlers({
      editor,
      updateSuggestions,
    });

    const handleSubmit = useCallback((snapshot: QuerySnapshot) => onSubmit?.(snapshot), [onSubmit]);
    const handleClear = useCallback(() => onClear?.(), [onClear]);
    const heldCalls = useTokenizedSearchInputRef(ref, editor);
    useEditorConfigSync(editor, config, {
      onFieldSelect: handleFieldSelect,
      onValueSelect: handleValueSelect,
      onCustomSelect: handleCustomSelect,
      onSubmit: handleSubmit,
      onClear: handleClear,
    });

    useFocusWiring({
      editor,
      containerRef,
      onFocus,
      onBlur,
      updateSuggestions,
      updateCustomSuggestions,
    });
    useSuggestionScheduling({
      editor,
      updateSuggestions,
      updateCustomSuggestions,
      singleLine,
      expandOnFocus,
      containerRef,
    });
    // Last on purpose: see useRunHeldHandleCalls.
    useRunHeldHandleCalls(editor, heldCalls);

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
          classNames?.container
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
                onClick={() => editor?.commands.clear()}
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
          <SuggestionAria
            editor={editor}
            listboxId={suggestionListId}
            optionIdPrefix={suggestionOptionIdPrefix}
          />
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
