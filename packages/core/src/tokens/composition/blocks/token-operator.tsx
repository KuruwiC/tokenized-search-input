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
}: TokenOperatorProps): React.ReactElement | null {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(() => operators.indexOf(value));
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(
    null
  );

  const { isFocused: tokenFocused, isEditable } = useTokenFocusContext();
  const { navigateLeft, navigateRight, navigateLeftEntry, navigateRightEntry, tabIndex } =
    useFocusableBlock({
      id: 'operator',
      ref: triggerRef,
      // Single operator: not focusable (renders as static text instead of button)
      isAvailable: () => operators.length > 1,
      entryFocusable: false,
    });

  // Find portal container (.tsi-container) to preserve CSS variable scope
  useEffect(() => {
    if (!tokenFocused || !triggerRef.current) {
      setPortalContainer(null);
      return;
    }
    const container = triggerRef.current.closest('.tsi-container');
    setPortalContainer(container as HTMLElement | null);
  }, [tokenFocused]);

  // Update dropdown position when open, and handle scroll/resize
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4, // 4px gap, using fixed positioning relative to viewport
        left: rect.left,
      });
    };

    updatePosition();

    // Update position on scroll (capture phase for nested scroll containers) and resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  // Scroll active item into view when activeIndex changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeIndex intentionally triggers scroll when selection changes via keyboard navigation
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeItem = listRef.current.querySelector(
        '[data-active="true"]'
      ) as HTMLElement | null;
      scrollIntoViewNearest(activeItem);
    }
  }, [isOpen, activeIndex]);

  const openDropdown = () => {
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
    // Focus moves to value input with cursor at end (more natural after operator selection)
    navigateRight('end');
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!listRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  // For single operator or unfocused token: render as static text
  if (!tokenFocused || operators.length <= 1) {
    return <span className={cn('tsi-token-operator', className)}>{getLabel(value)}</span>;
  }

  // Multiple operators with focused token: render as interactive dropdown
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
            className="tsi-token-operator__dropdown"
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
                  className="tsi-token-operator__option"
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
