import { Check } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DEFAULT_TOKEN_DELIMITER,
  type FieldDefinition,
  type LabelResolver,
  type Matcher,
} from '../../../../types';
import { cn } from '../../../../utils/cn';
import { resolveLabel } from '../../../../utils/label-resolve';
import { scrollIntoViewNearest } from '../../../../utils/scroll-into-view';
import { useTokenFocusContext } from '../../contexts';
import { useFocusableBlock } from '../../focus';
import { getSortedFields } from './field-compatibility';
import {
  handleClosedKeyDown,
  handleInputOnlyOpenKeyDown,
  handleOpenKeyDown,
} from './token-label-keyboard-handlers';

// Module-level singleton for text width measurement
let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function getTextMeasureContext(): CanvasRenderingContext2D | null {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
    measureCtx = measureCanvas.getContext('2d');
  }
  return measureCtx;
}

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFocusNextRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const [inputWidth, setInputWidth] = useState(20);
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

  const { isFocused: tokenFocused, isEditable, focusRegistry, immutable } = useTokenFocusContext();
  const { navigateLeft, navigateRight, navigateLeftEntry, navigateRightEntry, tabIndex } =
    useFocusableBlock({
      id: 'label',
      ref: triggerRef,
      available: displayMode !== 'static' && !immutable,
      entryFocusable: false,
    });

  const filteredFields = useMemo(() => {
    return getSortedFields(field, selectableFields, {
      inputQuery: hasUserEdited ? inputValue : '',
      excludeCurrent: false,
      matcher: suggestionMatcher,
    });
  }, [field, selectableFields, inputValue, hasUserEdited, suggestionMatcher]);

  const totalOptions = filteredFields.length;

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    };

    updatePosition();

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeIndex intentionally triggers scroll
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeItem = listRef.current.querySelector(
        '[data-active="true"]'
      ) as HTMLElement | null;
      scrollIntoViewNearest(activeItem);
    }
  }, [isOpen, activeIndex]);

  const hasTextInput = displayMode === 'dropdown-with-input' || displayMode === 'input-only';
  const showInput = isOpen && hasTextInput;
  useEffect(() => {
    if (!showInput) return;

    const input = inputRef.current;
    if (!input) return;

    const ctx = getTextMeasureContext();
    if (!ctx) return;

    const computedStyle = window.getComputedStyle(input);
    const font = `${computedStyle.fontStyle} ${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
    const text = inputValue || label || 'a';

    ctx.font = font;
    const textWidth = ctx.measureText(text).width;
    const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;

    setInputWidth(Math.max(20, Math.ceil(textWidth + paddingLeft + 4)));
  }, [inputValue, showInput, label]);

  useEffect(() => {
    if (isOpen && hasTextInput && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen, hasTextInput]);

  const openDropdown = useCallback(() => {
    if (triggerRef.current) {
      const container = triggerRef.current.closest('.tsi-container');
      setPortalContainer(container as HTMLElement | null);
    }
    setIsOpen(true);
    setInputValue(label);
    setHasUserEdited(false);
    const sortedFields = getSortedFields(field, selectableFields, {
      inputQuery: '',
      excludeCurrent: false,
    });
    setActiveIndex(field ? sortedFields.findIndex((f) => f.key === field.key) : -1);
    onOpen?.();
  }, [label, field, selectableFields, onOpen]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setInputValue('');
  }, []);

  const selectField = useCallback(
    (inputKey: string) => {
      const trimmedInput = inputKey.trim();
      if (!trimmedInput) {
        return;
      }

      const resolvedKey = resolveLabel(selectableFields, trimmedInput, {
        resolver: labelResolver,
      });

      if (resolvedKey === currentKey) {
        return;
      }

      onFieldChange(resolvedKey);
    },
    [selectableFields, labelResolver, currentKey, onFieldChange]
  );

  const selectFieldAndNavigate = useCallback(
    (key: string) => {
      selectField(key);
      setIsOpen(false);
      pendingFocusNextRef.current = true;
    },
    [selectField]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: isOpen triggers focus navigation on dropdown close
  useEffect(() => {
    if (!pendingFocusNextRef.current) return;
    pendingFocusNextRef.current = false;
    focusRegistry.focusNext('label', 'end');
  }, [isOpen, focusRegistry]);

  const moveActiveUp = useCallback(() => {
    setActiveIndex((prev) => Math.max(prev - 1, -1));
  }, []);

  const moveActiveDown = useCallback(() => {
    setActiveIndex((prev) => Math.min(prev + 1, totalOptions - 1));
  }, [totalOptions]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (hasTextInput && isOpen && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        return;
      }

      if (isOpen && e.key === 'Escape') {
        setIsOpen(false);
        setInputValue('');
        triggerRef.current?.focus();
        e.preventDefault();
        return;
      }

      let handled: boolean;

      if (isOpen) {
        if (displayMode === 'input-only') {
          handled = handleInputOnlyOpenKeyDown(
            e.key,
            {
              inputValue,
              selectionStart: inputRef.current?.selectionStart ?? null,
              selectionEnd: inputRef.current?.selectionEnd ?? null,
            },
            {
              selectFieldAndClose: (value) => {
                selectField(value);
                closeDropdown();
              },
              closeAndNavigateLeft: () => {
                closeDropdown();
                navigateLeft();
              },
              closeAndNavigateRight: (position) => {
                closeDropdown();
                navigateRight(position);
              },
            }
          );
        } else {
          handled = handleOpenKeyDown(
            e.key,
            { isOpen, activeIndex, filteredFields },
            {
              closeDropdown,
              navigateLeft,
              navigateRight,
              selectField,
              selectFieldAndNavigate,
              moveActiveUp,
              moveActiveDown,
            }
          );
        }
      } else {
        handled = handleClosedKeyDown(e.key, {
          openDropdown,
          navigateLeft,
          navigateRight,
          navigateLeftEntry,
          navigateRightEntry,
        });
      }

      if (handled) {
        e.preventDefault();
      }
    },
    [
      hasTextInput,
      isOpen,
      displayMode,
      inputValue,
      activeIndex,
      filteredFields,
      closeDropdown,
      navigateLeft,
      navigateRight,
      selectField,
      selectFieldAndNavigate,
      moveActiveUp,
      moveActiveDown,
      openDropdown,
      navigateLeftEntry,
      navigateRightEntry,
    ]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const sanitized = rawValue.split(DEFAULT_TOKEN_DELIMITER).join('').replace(/\s/g, '');
    setInputValue(sanitized);
    setHasUserEdited(true);
    setActiveIndex(0);
  }, []);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (listRef.current?.contains(e.relatedTarget as Node)) {
        return;
      }
      if (inputRef.current?.contains(e.relatedTarget as Node)) {
        return;
      }

      if (hasTextInput && hasUserEdited && inputValue.trim()) {
        selectField(inputValue.trim());
      }

      setIsOpen(false);
      setInputValue('');
    },
    [hasTextInput, hasUserEdited, inputValue, selectField]
  );

  if (!tokenFocused || displayMode === 'static' || immutable) {
    return (
      <span className={cn('tsi-token-label', className)}>
        {hasIcon && <span className="tsi-token-label__icon">{field?.icon}</span>}
        {showText && <span className="tsi-token-label__text">{label}</span>}
      </span>
    );
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => (isOpen ? closeDropdown() : openDropdown())}
      onMouseDown={(e) => {
        if (!isOpen) e.preventDefault();
      }}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={cn('tsi-token-label-combobox', className)}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-label="Select field"
      data-state={isOpen ? 'open' : 'closed'}
      data-editable={isEditable}
      tabIndex={tabIndex}
    >
      {hasIcon && <span className="tsi-token-label-combobox__icon">{field?.icon}</span>}
      {isOpen && hasTextInput ? (
        <input
          ref={inputRef}
          type="text"
          value={hasUserEdited ? inputValue : inputValue || label}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            handleKeyDown(e);
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.stopPropagation();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="tsi-token-label-combobox__input"
          style={{ width: `${inputWidth}px` }}
          autoComplete="off"
          spellCheck={false}
        />
      ) : (
        showText && <span className="tsi-token-label-combobox__text">{label}</span>
      )}

      {isOpen &&
        displayMode !== 'input-only' &&
        dropdownPosition &&
        portalContainer &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            aria-label="Fields"
            style={{
              position: 'fixed',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
            className="tsi-token-label-combobox__dropdown"
          >
            {filteredFields.map((f, index) => {
              const isActive = index === activeIndex;
              const isSelected = f.key === currentKey;

              return (
                <div
                  key={f.key}
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  data-active={isActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectFieldAndNavigate(f.key);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectFieldAndNavigate(f.key);
                    }
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className="tsi-token-label-combobox__option"
                >
                  <span className="tsi-token-label-combobox__check">
                    {isSelected && <Check className="tsi-token-label-combobox__check-icon" />}
                  </span>
                  {f.icon && (
                    <span className="tsi-token-label-combobox__option-icon">{f.icon}</span>
                  )}
                  <span className="tsi-token-label-combobox__option-label" title={f.label}>
                    {f.label}
                  </span>
                  <span className="tsi-token-label-combobox__option-key" title={f.key}>
                    {f.key}
                  </span>
                </div>
              );
            })}

            {filteredFields.length === 0 && (
              <div className="tsi-token-label-combobox__empty">No matching fields</div>
            )}
          </div>,
          portalContainer
        )}
    </button>
  );
}
