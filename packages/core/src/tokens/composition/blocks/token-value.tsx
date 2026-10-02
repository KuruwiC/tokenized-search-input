import { useCallback, useRef } from 'react';
import { useTextWidth } from '../../../hooks/use-text-width';
import { cn } from '../../../utils/cn';
import { type CursorPosition, useTokenFocusContext } from '../contexts/token-focus-context';
import { useFocusableBlock } from '../focus';

/** Renders an icon slot with consistent styling */
export function TokenIconSlot({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement | null {
  if (!children) return null;
  return <span className="tsi-icon-slot">{children}</span>;
}

export interface TokenValueProps {
  value: string;
  onChange: (value: string) => void;
  allowSpaces?: boolean;
  placeholder?: string;
  className?: string;
  /** Custom class name for the container element (.tsi-token-value) */
  containerClassName?: string;
  ariaLabel?: string;
  onFocus?: () => void;
  /** Content to display before the value (e.g., icon) */
  startContent?: React.ReactNode;
  /** Content to display after the value (e.g., icon) */
  endContent?: React.ReactNode;
  /**
   * Called when space is pressed at a non-end position while allowSpaces is false.
   * If provided and returns true, the space will be inserted (preventDefault is skipped).
   * Use this for custom handling like auto-quote conversion in free text tokens.
   * @param cursorState.atStart - true if cursor is at the beginning of the value
   */
  onSpaceNotAtEnd?: (cursorState: { atStart: boolean }) => boolean;
  /** Handles a key before the block does, for instance to navigate suggestions; true when handled. */
  handleKey?: (e: React.KeyboardEvent) => boolean;
}

/**
 * Token value input block (focusable).
 * Auto-sizing text input for token values.
 *
 * It handles the keys pressed in its input; a view can handle keys of its own first
 * through `handleKey`.
 */
export function TokenValue({
  value,
  onChange,
  allowSpaces = false,
  placeholder = '...',
  className = '',
  containerClassName,
  ariaLabel = 'Value',
  onFocus,
  startContent,
  endContent,
  onSpaceNotAtEnd,
  handleKey: handleViewKey,
}: TokenValueProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isFocused: tokenFocused, exitToken, currentFocusId } = useTokenFocusContext();

  const focusInput = useCallback((position?: CursorPosition) => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (position === 'start') {
      input.setSelectionRange(0, 0);
    } else {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, []);

  const handleKey = (e: React.KeyboardEvent): boolean => {
    // Keys pressed during composition belong to the input method
    if (e.nativeEvent.isComposing) return false;
    if (handleViewKey?.(e)) return true;

    const input = inputRef.current;
    if (!input) return false;
    const caret = input.selectionStart ?? 0;
    const collapsed = caret === (input.selectionEnd ?? 0);
    const atStart = caret === 0;
    const atEnd = caret === value.length;

    switch (e.key) {
      case 'ArrowLeft':
        if (!atStart || !collapsed) return false;
        e.preventDefault();
        navigateLeft();
        return true;
      case 'ArrowRight':
        if (!atEnd || !collapsed) return false;
        e.preventDefault();
        navigateRight();
        return true;
      case 'Backspace':
        // Backspace at the start moves to the previous entry-focusable block or leaves the token
        if (!atStart || !collapsed) return false;
        e.preventDefault();
        navigateLeftEntry();
        return true;
      case 'Delete':
        // Delete at the end moves to the next entry-focusable block or leaves the token
        if (!atEnd || !collapsed) return false;
        e.preventDefault();
        navigateRightEntry();
        return true;
      case ' ':
        if (allowSpaces) return false;
        if (atEnd) {
          e.preventDefault();
          exitToken();
          return true;
        }
        // Elsewhere the view may let the space in, for instance to quote the value
        if (onSpaceNotAtEnd?.({ atStart })) return false;
        e.preventDefault();
        return true;
      case 'Enter':
        e.preventDefault();
        exitToken();
        return true;
      default:
        return false;
    }
  };

  const {
    navigateLeft,
    navigateRight,
    navigateLeftEntry,
    navigateRightEntry,
    tabIndex,
    handleFocus: handleBlockFocus,
  } = useFocusableBlock({
    id: 'value',
    ref: inputRef,
    focus: focusInput,
    handleKey,
  });

  const inputWidth = useTextWidth(inputRef, value || placeholder, tokenFocused);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleFocus = () => {
    handleBlockFocus();
    onFocus?.();
  };

  const isValueFocused = tokenFocused && currentFocusId === 'value';

  // Render both span and input to avoid DOM remount flickering
  return (
    <span className={cn('tsi-token-value', containerClassName)} data-focused={isValueFocused}>
      {!tokenFocused && (
        <span className={cn('tsi-token-value__display', className)}>
          <TokenIconSlot>{startContent}</TokenIconSlot>
          <span className="tsi-token-value__display-text">{value || placeholder}</span>
          <TokenIconSlot>{endContent}</TokenIconSlot>
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        className={cn('tsi-token-value__input', className)}
        style={{
          width: tokenFocused ? inputWidth : 0,
          maxWidth: tokenFocused ? '100%' : undefined,
          opacity: tokenFocused ? 1 : 0,
          position: tokenFocused ? 'relative' : 'absolute',
          pointerEvents: tokenFocused ? 'auto' : 'none',
        }}
        placeholder={tokenFocused ? placeholder : undefined}
        aria-label={tokenFocused ? ariaLabel : undefined}
        tabIndex={tokenFocused ? tabIndex : -1}
        aria-hidden={!tokenFocused}
        autoComplete="off"
        spellCheck={false}
      />
    </span>
  );
}
