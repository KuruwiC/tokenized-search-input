import { useRef } from 'react';
import { Check } from '../../../icons/check';
import { ChevronDown } from '../../../icons/chevron-down';
import { cn } from '../../../utils/cn';
import { useTokenFocusContext } from '../contexts/token-focus-context';
import { useFocusableBlock } from '../focus';
import { handleClosedKey, TokenDropdown, useTokenDropdown } from './token-dropdown';

export interface TokenOperatorProps {
  value: string;
  operators: readonly string[];
  getLabel: (op: string) => string;
  onChange: (op: string) => void;
  onOpen?: () => void;
  className?: string;
  dropdownClassName?: string;
  itemClassName?: string;
}

/**
 * Token operator block (focusable dropdown).
 * Allows selecting from available operators.
 */
export function TokenOperator({
  value,
  operators,
  getLabel,
  onChange,
  onOpen,
  className = '',
  dropdownClassName,
  itemClassName,
}: TokenOperatorProps): React.ReactElement | null {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdown = useTokenDropdown(triggerRef, onOpen);
  const { showsControls, isEditable } = useTokenFocusContext();
  // A value outside `operators` can only be repaired by choosing one of them, even if only one exists.
  const choosable = operators.length > 1 || !operators.includes(value);
  const interactive = showsControls && choosable;

  const openDropdown = () => dropdown.open(operators.indexOf(value));

  const handleOpenKey = ({ key, shiftKey }: React.KeyboardEvent): boolean => {
    if (dropdown.handleListKey(key, { min: 0, max: operators.length - 1 })) return true;
    switch (key) {
      case 'Enter':
      case ' ': {
        const operator = operators[dropdown.activeIndex];
        if (operator !== undefined) {
          onChange(operator);
          dropdown.close();
        }
        return true;
      }
      case 'Tab':
        dropdown.close();
        if (shiftKey) navigateLeft();
        else navigateRight();
        return true;
      default:
        return false;
    }
  };

  const handleKey = (e: React.KeyboardEvent): boolean => {
    const handled = dropdown.isOpen
      ? handleOpenKey(e)
      : handleClosedKey(e, openDropdown, {
          left: navigateLeft,
          right: navigateRight,
          leftEntry: navigateLeftEntry,
          rightEntry: navigateRightEntry,
        });
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
    id: 'operator',
    ref: triggerRef,
    available: interactive,
    entryFocusable: false,
    handleKey,
    activate: () => (dropdown.isOpen ? dropdown.close() : openDropdown()),
  });

  const handleSelect = (operator: string) => {
    onChange(operator);
    dropdown.close();
    navigateRight('end');
  };

  if (!interactive) {
    return <span className={cn('tsi-token-operator', className)}>{getLabel(value)}</span>;
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      {...blockProps}
      tabIndex={tabIndex}
      onBlur={(e) => {
        if (!dropdown.holdsFocus(e.relatedTarget)) dropdown.close();
      }}
      className={cn('tsi-token-operator--interactive', className)}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={dropdown.isOpen}
      aria-controls={dropdown.isOpen ? dropdown.listId : undefined}
      aria-activedescendant={dropdown.activeOptionId(operators.length)}
      aria-label="Select operator"
      data-state={dropdown.isOpen ? 'open' : 'closed'}
      data-editable={isEditable}
    >
      <span className="tsi-token-operator__label">{getLabel(value)}</span>
      <ChevronDown className="tsi-token-operator__chevron" />

      <TokenDropdown
        dropdown={dropdown}
        label="Operators"
        options={operators.map((operator) => ({
          key: operator,
          selected: operator === value,
          content: (
            <>
              <span className="tsi-token-operator__check">
                {operator === value && <Check className="tsi-token-operator__check-icon" />}
              </span>
              <span>{getLabel(operator)}</span>
            </>
          ),
        }))}
        onSelect={handleSelect}
        className={cn('tsi-token-operator__dropdown', dropdownClassName)}
        optionClassName={cn('tsi-token-operator__option', itemClassName)}
      />
    </button>
  );
}
