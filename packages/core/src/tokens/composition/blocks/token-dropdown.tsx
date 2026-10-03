import { type ReactNode, type RefObject, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../utils/cn';
import { useScrollActiveIntoView } from '../../../utils/scroll-into-view';
import type { CursorPosition } from '../contexts/token-focus-context';

const NO_ACTIVE_OPTION = -1;

const LIST_OFFSET = 4;

interface ListPlacement {
  container: HTMLElement;
  top: number;
  left: number;
}

interface ActiveBounds {
  min: number;
  max: number;
}

export interface BlockNavigation {
  left: () => void;
  right: (position?: CursorPosition) => void;
  leftEntry: () => void;
  rightEntry: () => void;
}

export interface TokenDropdownState {
  isOpen: boolean;
  /** The option the keys act on, or -1 for none. */
  activeIndex: number;
  /** The id of the list, for the trigger's aria-controls while the list is shown. */
  listId: string;
  anchorRef: RefObject<HTMLElement | null>;
  listRef: RefObject<HTMLDivElement>;
  placement: ListPlacement | null;
  open: (activeIndex?: number) => void;
  close: () => void;
  setActiveIndex: (index: number) => void;
  /** The id of option `index`, which the trigger names as active through aria-activedescendant. */
  optionId: (index: number) => string;
  /** The id of the active option while the list is open and has such an option, else undefined. */
  activeOptionId: (optionCount: number) => string | undefined;
  /** Whether `target` is the trigger, something inside it, or the list. */
  holdsFocus: (target: EventTarget | null) => boolean;
  /**
   * Handles the keys every open list shares: Arrow keys move the active option within
   * `bounds`, omitted when there is no list, and Escape closes only the list.
   * @returns whether the key was handled
   */
  handleListKey: (key: string, bounds?: ActiveBounds) => boolean;
}

/**
 * The open state of a token's dropdown, where its list goes, and the keys every list
 * shares. `anchorRef` is the trigger the list hangs from; `onOpen` runs when the list opens.
 */
export function useTokenDropdown(
  anchorRef: RefObject<HTMLElement | null>,
  onOpen?: () => void
): TokenDropdownState {
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(NO_ACTIVE_OPTION);
  const [placement, setPlacement] = useState<ListPlacement | null>(null);

  // The list is fixed to the viewport below the trigger and follows it while the page moves
  useLayoutEffect(() => {
    if (!isOpen) return;
    const anchor = anchorRef.current;
    const container = anchor?.closest<HTMLElement>('.tsi-container');
    if (!anchor || !container) return;

    // A scroll inside the list, or of something else, leaves the trigger where it was
    let placedTop: number | undefined;
    let placedLeft: number | undefined;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const top = rect.bottom + LIST_OFFSET;
      const left = rect.left;
      if (top === placedTop && left === placedLeft) return;
      placedTop = top;
      placedLeft = left;
      setPlacement({ container, top, left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [isOpen, anchorRef]);

  const open = (index = NO_ACTIVE_OPTION) => {
    setActiveIndex(index);
    setIsOpen(true);
    onOpen?.();
  };

  const close = () => setIsOpen(false);

  const optionId = (index: number) => `${listId}-${index}`;

  const activeOptionId = (optionCount: number) =>
    isOpen && activeIndex >= 0 && activeIndex < optionCount ? optionId(activeIndex) : undefined;

  const holdsFocus = (target: EventTarget | null) =>
    target instanceof Node &&
    (anchorRef.current?.contains(target) === true || listRef.current?.contains(target) === true);

  const handleListKey = (key: string, bounds?: ActiveBounds) => {
    const move = (delta: number) => {
      if (!bounds) return false;
      setActiveIndex((index) => Math.min(Math.max(index + delta, bounds.min), bounds.max));
      return true;
    };
    switch (key) {
      case 'ArrowDown':
        return move(1);
      case 'ArrowUp':
        return move(-1);
      case 'Escape':
        close();
        anchorRef.current?.focus();
        return true;
      default:
        return false;
    }
  };

  return {
    isOpen,
    activeIndex,
    listId,
    anchorRef,
    listRef,
    placement,
    open,
    close,
    setActiveIndex,
    optionId,
    activeOptionId,
    holdsFocus,
    handleListKey,
  };
}

/**
 * The keys of a trigger whose list is closed: Enter, Space and ArrowDown open it, the rest
 * move focus to a neighbouring block; Tab goes right and Shift+Tab left.
 * @returns whether the key was handled
 */
export function handleClosedKey(
  { key, shiftKey }: Pick<React.KeyboardEvent, 'key' | 'shiftKey'>,
  open: () => void,
  navigation: BlockNavigation
) {
  switch (key) {
    case 'Enter':
    case ' ':
    case 'ArrowDown':
      open();
      return true;
    case 'ArrowLeft':
      navigation.left();
      return true;
    case 'ArrowRight':
      navigation.right();
      return true;
    case 'Tab':
      if (shiftKey) navigation.left();
      else navigation.right();
      return true;
    case 'Backspace':
      navigation.leftEntry();
      return true;
    case 'Delete':
      navigation.rightEntry();
      return true;
    default:
      return false;
  }
}

interface TokenDropdownOption {
  key: string;
  selected: boolean;
  content: ReactNode;
}

export interface TokenDropdownProps {
  dropdown: TokenDropdownState;
  label: string;
  options: readonly TokenDropdownOption[];
  onSelect: (key: string) => void;
  className?: string;
  optionClassName?: string;
  empty?: ReactNode;
}

/** The list of a token's dropdown, in the editor container and under the trigger. */
export function TokenDropdown({
  dropdown,
  label,
  options,
  onSelect,
  className,
  optionClassName,
  empty,
}: TokenDropdownProps): React.ReactElement | null {
  const { isOpen, placement } = dropdown;
  if (!isOpen || !placement) return null;

  return createPortal(
    <DropdownList
      id={dropdown.listId}
      optionId={dropdown.optionId}
      listRef={dropdown.listRef}
      label={label}
      options={options}
      activeIndex={dropdown.activeIndex}
      onActivate={dropdown.setActiveIndex}
      onSelect={onSelect}
      className={className}
      optionClassName={optionClassName}
      empty={empty}
      top={placement.top}
      left={placement.left}
    />,
    placement.container
  );
}

interface DropdownListProps {
  id: string;
  optionId: (index: number) => string;
  listRef: RefObject<HTMLDivElement>;
  label: string;
  options: readonly TokenDropdownOption[];
  activeIndex: number;
  onActivate: (index: number) => void;
  onSelect: (key: string) => void;
  className?: string;
  optionClassName?: string;
  empty?: ReactNode;
  top: number;
  left: number;
}

// Mounted only while the list is shown, so the active option is scrolled into view on open
function DropdownList({
  id,
  optionId,
  listRef,
  label,
  options,
  activeIndex,
  onActivate,
  onSelect,
  className,
  optionClassName,
  empty,
  top,
  left,
}: DropdownListProps): React.ReactElement {
  const optionRefs = useScrollActiveIntoView<HTMLButtonElement>(activeIndex);

  return (
    <div
      ref={listRef}
      id={id}
      role="listbox"
      aria-label={label}
      style={{ position: 'fixed', top, left }}
      className={cn('tsi-popover', className)}
    >
      {options.map((option, index) => (
        <button
          key={option.key}
          type="button"
          ref={(element) => {
            if (element) optionRefs.current.set(index, element);
            else optionRefs.current.delete(index);
          }}
          id={optionId(index)}
          role="option"
          tabIndex={-1}
          aria-selected={option.selected}
          data-active={index === activeIndex}
          // Keep focus in the trigger while an option is pressed
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(option.key);
          }}
          onMouseEnter={() => onActivate(index)}
          className={optionClassName}
        >
          {option.content}
        </button>
      ))}
      {options.length === 0 && empty}
    </div>
  );
}
