import { useCallback, useRef } from 'react';
import { useTextWidth } from '../../../hooks/use-text-width';
import { cn } from '../../../utils/cn';
import { type CursorPosition, useTokenFocusContext } from '../contexts';
import { useFocusableBlock } from '../focus';
import { HandlerPriority, useBlockKeyboardContribution } from '../keyboard';

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
}

/**
 * Token value input block (focusable).
 * Auto-sizing text input for token values.
 *
 * Keyboard handling is registered via useBlockKeyboardContribution.
 * View-level handlers (e.g., suggestion navigation) should also use
 * useBlockKeyboardContribution with a different block ID.
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
}: TokenValueProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    isFocused: tokenFocused,
    exitToken,
    currentFocusId,
    dispatchKeyDown,
  } = useTokenFocusContext();

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
  });

  // Helper to get cursor state
  const getCursorState = () => {
    const input = inputRef.current;
    if (!input) return { atStart: false, atEnd: false, hasSelection: false };

    const cursorPos = input.selectionStart ?? 0;
    const cursorEnd = input.selectionEnd ?? 0;
    return {
      atStart: cursorPos === 0,
      atEnd: cursorPos === value.length,
      hasSelection: cursorPos !== cursorEnd,
    };
  };

  const keyboardHandlers = {
    ArrowLeft: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'value') return false;
        const { atStart, hasSelection } = getCursorState();
        if (atStart && !hasSelection) {
          e.preventDefault();
          navigateLeft();
          return true;
        }
        return false;
      },
      priority: HandlerPriority.DEFAULT,
    },
    ArrowRight: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'value') return false;
        const { atEnd, hasSelection } = getCursorState();
        if (atEnd && !hasSelection) {
          e.preventDefault();
          navigateRight();
          return true;
        }
        return false;
      },
      priority: HandlerPriority.DEFAULT,
    },
    Backspace: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'value') return false;
        if (e.nativeEvent.isComposing) return false;
        const { atStart, hasSelection } = getCursorState();
        // When at start with no selection, navigate to previous entryFocusable element or exit token
        if (atStart && !hasSelection) {
          e.preventDefault();
          navigateLeftEntry();
          return true;
        }
        return false;
      },
      priority: HandlerPriority.DEFAULT,
    },
    Delete: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'value') return false;
        if (e.nativeEvent.isComposing) return false;
        const { atEnd, hasSelection } = getCursorState();
        // When at end with no selection, navigate to next entryFocusable element or exit token
        if (atEnd && !hasSelection) {
          e.preventDefault();
          navigateRightEntry();
          return true;
        }
        return false;
      },
      priority: HandlerPriority.DEFAULT,
    },
    ' ': {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'value') return false;
        if (e.nativeEvent.isComposing) return false;
        if (!allowSpaces) {
          const { atStart, atEnd } = getCursorState();
          if (atEnd) {
            e.preventDefault();
            exitToken();
            return true;
          }
          // Non-end position: check if custom handler allows the space
          if (onSpaceNotAtEnd?.({ atStart })) {
            // Allow space insertion for custom handling (e.g., auto-quote conversion)
            return false;
          }
          e.preventDefault();
          return true;
        }
        return false;
      },
      priority: HandlerPriority.DEFAULT,
    },
    Enter: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'value') return false;
        if (e.nativeEvent.isComposing) return false;
        e.preventDefault();
        exitToken();
        return true;
      },
      priority: HandlerPriority.DEFAULT,
    },
  };

  useBlockKeyboardContribution('value', keyboardHandlers);

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
        onKeyDown={dispatchKeyDown}
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
