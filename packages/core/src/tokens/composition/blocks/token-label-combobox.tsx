import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getEditorContext } from '../../../extensions/editor-context';
import { useTextWidth } from '../../../hooks/use-text-width';
import { Check } from '../../../icons/check';
import type { FieldDefinition, LabelResolver, Matcher } from '../../../types';
import { cn } from '../../../utils/cn';
import { resolveLabel } from '../../../utils/label-resolve';
import { useTokenConfig } from '../contexts/token-config-context';
import { type CursorPosition, useTokenFocusContext } from '../contexts/token-focus-context';
import { useFocusableBlock } from '../focus';
import { getSortedFields } from './field-compatibility';
import { handleClosedKey, TokenDropdown, useTokenDropdown } from './token-dropdown';

export interface TokenLabelComboboxProps {
  field?: FieldDefinition;
  fallback?: string;
  className?: string;
  /** All available field definitions */
  selectableFields: readonly FieldDefinition[];
  /** Called when field changes */
  onFieldChange: (newKey: string) => void;
  /** Called when dropdown opens */
  onOpen?: () => void;
  /** Whether unknown fields are allowed (enables free text input) */
  allowUnknownFields?: boolean;
  /**
   * Matcher function for filtering label suggestions.
   * Use built-in matchers from `matchers` or provide a custom function.
   * @default matchers.fuzzy
   */
  suggestionMatcher?: Matcher;
  /**
   * Resolver function for converting user input to field key.
   * Use built-in resolvers from `labelResolvers` or provide a custom function.
   * @default labelResolvers.caseInsensitive
   */
  labelResolver?: LabelResolver;
}

type Leaving = { direction: 'next' | 'prev'; position?: CursorPosition };

/**
 * Token label combobox block (focusable).
 * Allows selecting from available fields.
 * When allowUnknownFields=true, also allows entering free text.
 * When allowUnknownFields=false, behaves like TokenOperator (dropdown only, no text input).
 */
export function TokenLabelCombobox({
  field,
  fallback,
  className = '',
  selectableFields,
  onFieldChange,
  onOpen,
  allowUnknownFields = false,
  suggestionMatcher,
  labelResolver,
}: TokenLabelComboboxProps): React.ReactElement {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const leavingRef = useRef<Leaving | null>(null);
  // Whether the combobox is open and has neither chosen nor dropped what was typed. However
  // it ends, the typed text is committed at most once.
  const pendingRef = useRef(false);
  const dropdown = useTokenDropdown(triggerRef, onOpen);
  const [inputValue, setInputValue] = useState('');
  const [hasUserEdited, setHasUserEdited] = useState(false);

  const label = field?.label || fallback || '';
  const currentKey = field?.key || fallback || '';
  const hasIcon = !!field?.icon;
  const tokenLabelDisplay = field?.tokenLabelDisplay ?? 'auto';
  const showText = tokenLabelDisplay === 'auto' || (tokenLabelDisplay === 'icon-only' && !hasIcon);

  const displayMode = useMemo(() => {
    const hasMultipleFields = selectableFields.length > 1;
    if (allowUnknownFields) {
      return hasMultipleFields ? 'dropdown-with-input' : 'input-only';
    }
    return hasMultipleFields ? 'dropdown' : 'static';
  }, [selectableFields.length, allowUnknownFields]);
  const hasTextInput = displayMode === 'dropdown-with-input' || displayMode === 'input-only';
  const hasList = displayMode !== 'input-only';

  const { editor } = useTokenConfig();
  const { isFocused: tokenFocused, isEditable, focusRegistry, immutable } = useTokenFocusContext();

  const filteredFields = useMemo(() => {
    return getSortedFields(field, selectableFields, {
      inputQuery: hasUserEdited ? inputValue : '',
      excludeCurrent: false,
      matcher: suggestionMatcher,
    });
  }, [field, selectableFields, inputValue, hasUserEdited, suggestionMatcher]);

  const showInput = dropdown.isOpen && hasTextInput;
  const inputWidth = useTextWidth(inputRef, inputValue || label || 'a', showInput);

  useEffect(() => {
    if (showInput) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [showInput]);

  // Leaving the combobox for a neighbouring block waits until it is closed and the input is gone:
  // moving focus while the input is still there would blur it.
  useLayoutEffect(() => {
    const leaving = leavingRef.current;
    if (dropdown.isOpen || !leaving) return;
    leavingRef.current = null;
    focusRegistry.focusAdjacent('label', leaving.direction, { position: leaving.position });
  }, [dropdown.isOpen, focusRegistry]);

  const openDropdown = () => {
    pendingRef.current = true;
    setInputValue(label);
    setHasUserEdited(false);
    const sortedFields = getSortedFields(field, selectableFields, {
      inputQuery: '',
      excludeCurrent: false,
    });
    dropdown.open(field ? sortedFields.findIndex((f) => f.key === field.key) : -1);
  };

  const selectField = (inputKey: string) => {
    const trimmedInput = inputKey.trim();
    if (!trimmedInput) return;

    const resolvedKey = resolveLabel(selectableFields, trimmedInput, { resolver: labelResolver });
    if (resolvedKey === currentKey) return;

    onFieldChange(resolvedKey);
  };

  const hasDraft = hasTextInput && hasUserEdited && inputValue.trim() !== '';

  // Ends the open combobox: with the field `chosenKey` names, or else with the text the user
  // typed, if any. Whichever way it ends, it ends once.
  const settle = (chosenKey?: string) => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    if (chosenKey !== undefined) selectField(chosenKey);
    else if (hasDraft) selectField(inputValue.trim());
    dropdown.close();
  };

  const leave = (
    direction: Leaving['direction'],
    position?: Leaving['position'],
    chosenKey?: string
  ): true => {
    settle(chosenKey);
    leavingRef.current = { direction, position };
    return true;
  };

  const activeField = filteredFields[dropdown.activeIndex];

  const handleOpenKey = (e: React.KeyboardEvent): boolean => {
    switch (e.key) {
      case 'Tab':
        return e.shiftKey ? leave('prev') : leave('next', 'end', activeField?.key);
      case 'ArrowRight':
        return leave('next', 'end', activeField?.key);
      case 'Enter':
        if (!activeField && !hasDraft) return false;
        return leave('next', 'end', activeField?.key);
      case 'ArrowLeft':
        return leave('prev');
      default:
        return false;
    }
  };

  // Without a list, the text is the only thing to choose from: Arrow keys leave only at its ends
  const handleInputOnlyKey = (e: React.KeyboardEvent): boolean => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? null;
    const collapsed = start === (input?.selectionEnd ?? null);
    const atStart = start === 0 && collapsed;
    const atEnd = start === inputValue.length && collapsed;

    switch (e.key) {
      case 'Tab':
        return e.shiftKey ? leave('prev') : leave('next', 'end');
      case 'Enter':
        return leave('next', 'end');
      case 'ArrowRight':
        return atEnd && leave('next', 'end');
      case 'ArrowLeft':
        return atStart && leave('prev');
      default:
        return false;
    }
  };

  const handleKey = (e: React.KeyboardEvent): boolean => {
    let handled: boolean;
    if (!dropdown.isOpen) {
      handled = handleClosedKey(e, openDropdown, {
        left: navigateLeft,
        right: navigateRight,
        leftEntry: navigateLeftEntry,
        rightEntry: navigateRightEntry,
      });
    } else if (hasTextInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // A character typed into the input
      return false;
    } else {
      // Escape drops what was typed
      if (e.key === 'Escape') pendingRef.current = false;
      handled =
        dropdown.handleListKey(
          e.key,
          hasList ? { min: -1, max: filteredFields.length - 1 } : undefined
        ) || (hasList ? handleOpenKey(e) : handleInputOnlyKey(e));
    }

    if (handled) e.preventDefault();
    return handled;
  };

  const {
    navigateLeft,
    navigateRight,
    navigateLeftEntry,
    navigateRightEntry,
    tabIndex,
    blockProps,
  } = useFocusableBlock({
    id: 'label',
    ref: triggerRef,
    available: displayMode !== 'static' && !immutable,
    entryFocusable: false,
    handleKey,
    activate: () => (pendingRef.current ? settle() : openDropdown()),
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { delimiter } = getEditorContext(editor);
    setInputValue(e.target.value.split(delimiter).join('').replace(/\s/g, ''));
    setHasUserEdited(true);
    dropdown.setActiveIndex(0);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!dropdown.holdsFocus(e.relatedTarget)) settle();
  };

  if (!tokenFocused || displayMode === 'static' || immutable) {
    return (
      <span className={cn('tsi-token-label', className)}>
        {hasIcon && <span className="tsi-token-label__icon">{field?.icon}</span>}
        {showText && <span className="tsi-token-label__text">{label}</span>}
      </span>
    );
  }

  // The combobox is the element that takes the text, so it is the input while there is one and
  // the trigger otherwise. A text field that offers no list is not a combobox at all.
  const comboboxProps = {
    role: 'combobox',
    'aria-label': 'Select field',
    'aria-haspopup': 'listbox',
    'aria-expanded': dropdown.isOpen,
    'aria-controls': dropdown.isOpen ? dropdown.listId : undefined,
    'aria-activedescendant': dropdown.activeOptionId(filteredFields.length),
  } as const;
  // A press on the trigger keeps focus where it is; a press in the input places the caret
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  const triggerProps = showInput
    ? {}
    : hasList
      ? { ...comboboxProps, onMouseDown: keepFocus, onBlur: handleBlur }
      : ({
          role: 'button',
          'aria-label': 'Select field',
          onMouseDown: keepFocus,
          onBlur: handleBlur,
        } as const);

  return (
    <span
      ref={triggerRef}
      {...triggerProps}
      {...blockProps}
      tabIndex={tabIndex}
      className={cn('tsi-token-label-combobox', className)}
      data-state={dropdown.isOpen ? 'open' : 'closed'}
      data-editable={isEditable}
    >
      {hasIcon && <span className="tsi-token-label-combobox__icon">{field?.icon}</span>}
      {showInput ? (
        <input
          ref={inputRef}
          type="text"
          value={hasUserEdited ? inputValue : inputValue || label}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className="tsi-token-label-combobox__input"
          style={{ width: inputWidth }}
          {...(hasList
            ? { ...comboboxProps, 'aria-autocomplete': 'list' }
            : { 'aria-label': 'Field' })}
          autoComplete="off"
          spellCheck={false}
        />
      ) : (
        showText && <span className="tsi-token-label-combobox__text">{label}</span>
      )}

      {hasList && (
        <TokenDropdown
          dropdown={dropdown}
          label="Fields"
          options={filteredFields.map((f) => ({
            key: f.key,
            selected: f.key === currentKey,
            content: (
              <>
                <span className="tsi-token-label-combobox__check">
                  {f.key === currentKey && (
                    <Check className="tsi-token-label-combobox__check-icon" />
                  )}
                </span>
                {f.icon && <span className="tsi-token-label-combobox__option-icon">{f.icon}</span>}
                <span className="tsi-token-label-combobox__option-label" title={f.label}>
                  {f.label}
                </span>
                <span className="tsi-token-label-combobox__option-key" title={f.key}>
                  {f.key}
                </span>
              </>
            ),
          }))}
          onSelect={(key) => leave('next', 'end', key)}
          className="tsi-token-label-combobox__dropdown"
          optionClassName="tsi-token-label-combobox__option"
          empty={<div className="tsi-token-label-combobox__empty">No matching fields</div>}
        />
      )}
    </span>
  );
}
