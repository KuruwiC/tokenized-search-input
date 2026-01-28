import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../utils/cn';
import { scrollIntoViewNearest } from '../../../utils/scroll-into-view';
import { useTokenFocusContext } from '../contexts';
import { useFocusableBlock } from '../focus';
import { handleClosedKeyDown, handleOpenKeyDown } from './token-operator-keyboard-handlers';

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
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(() => operators.indexOf(value));
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(
    null
  );

  const { isFocused: tokenFocused, isEditable, immutable } = useTokenFocusContext();
  const { navigateLeft, navigateRight, navigateLeftEntry, navigateRightEntry, tabIndex } =
    useFocusableBlock({
      id: 'operator',
      ref: triggerRef,
      available: operators.length > 1 && !immutable,
      entryFocusable: false,
    });

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

  const openDropdown = () => {
    if (triggerRef.current) {
      const container = triggerRef.current.closest('.tsi-container');
      setPortalContainer(container as HTMLElement | null);
    }
    setIsOpen(true);
    setActiveIndex(operators.indexOf(value));
    onOpen?.();
  };

  const closeDropdown = () => {
    setIsOpen(false);
  };

  const moveActiveUp = () => {
    setActiveIndex((prev) => Math.max(prev - 1, 0));
  };

  const moveActiveDown = () => {
    setActiveIndex((prev) => Math.min(prev + 1, operators.length - 1));
  };

  const selectOperator = (op: string) => {
    onChange(op);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const handled = isOpen
      ? handleOpenKeyDown(
          e.key,
          { isOpen, activeIndex, operators },
          {
            closeDropdown,
            navigateRight,
            selectOperator,
            moveActiveUp,
            moveActiveDown,
          }
        )
      : handleClosedKeyDown(e.key, {
          openDropdown,
          navigateLeft,
          navigateRight,
          navigateLeftEntry,
          navigateRightEntry,
        });

    if (handled) {
      e.preventDefault();
    }
  };

  const handleSelect = (op: string) => {
    onChange(op);
    setIsOpen(false);
    navigateRight('end');
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!listRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  if (!tokenFocused || operators.length <= 1 || immutable) {
    return <span className={cn('tsi-token-operator', className)}>{getLabel(value)}</span>;
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={cn('tsi-token-operator--interactive', className)}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-label="Select operator"
      data-state={isOpen ? 'open' : 'closed'}
      data-editable={isEditable}
      tabIndex={tabIndex}
    >
      <span className="tsi-token-operator__label">{getLabel(value)}</span>
      <ChevronDown className="tsi-token-operator__chevron" />

      {isOpen &&
        dropdownPosition &&
        portalContainer &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            aria-label="Operators"
            style={{
              position: 'fixed',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
            className={cn('tsi-token-operator__dropdown', dropdownClassName)}
          >
            {operators.map((op, index) => {
              const isActive = index === activeIndex;
              const isSelected = op === value;

              return (
                <div
                  key={op}
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  data-active={isActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(op);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(op);
                    }
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn('tsi-token-operator__option', itemClassName)}
                >
                  <span className="tsi-token-operator__check">
                    {isSelected && <Check className="tsi-token-operator__check-icon" />}
                  </span>
                  <span>{getLabel(op)}</span>
                </div>
              );
            })}
          </div>,
          portalContainer
        )}
    </button>
  );
}
