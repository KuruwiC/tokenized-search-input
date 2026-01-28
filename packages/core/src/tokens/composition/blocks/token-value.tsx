import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { type CursorPosition, useTokenFocusContext } from '../contexts';
import { useFocusableBlock } from '../focus';
import { HandlerPriority, useBlockKeyboardContribution } from '../keyboard';

/** Icon slot style for consistent icon rendering in token values */
export const TOKEN_ICON_SLOT_CLASS = 'tsi-icon-slot';

/** Renders an icon slot with consistent styling */
export function TokenIconSlot({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement | null {
  if (!children) return null;
  return <span className={TOKEN_ICON_SLOT_CLASS}>{children}</span>;
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
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onConfirm?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
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
  onBlur,
  onConfirm,
  inputRef: externalInputRef,
  startContent,
  endContent,
  onSpaceNotAtEnd,
}: TokenValueProps): React.ReactElement {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;
  const {
    isFocused: tokenFocused,
    exitToken,
    currentFocusId,
    dispatchKeyDown,
  } = useTokenFocusContext();
  const [inputWidth, setInputWidth] = useState<number>(20);

  const focusInput = useCallback(
    (position?: CursorPosition) => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      if (position === 'start') {
        input.setSelectionRange(0, 0);
      } else {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    },
    [inputRef]
  );

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
            if (onConfirm) {
              onConfirm();
            } else {
              exitToken();
            }
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
        if (onConfirm) {
          onConfirm();
        } else {
          exitToken();
        }
        return true;
      },
      priority: HandlerPriority.DEFAULT,
    },
  };

  useBlockKeyboardContribution('value', keyboardHandlers);

  // Update input width based on value using temporary DOM measurement span
  // This is more accurate than Canvas API as it uses the same rendering engine
  // biome-ignore lint/correctness/useExhaustiveDependencies: inputRef.current is accessed at execution time; ref objects are stable and don't belong in deps
  useLayoutEffect(() => {
    // Only measure when focused (input is visible)
    if (!tokenFocused) return;

    const input = inputRef.current;
    if (!input) return;

    // Create temporary measurement span with same styles as input
    const measureSpan = document.createElement('span');
    measureSpan.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre;
      pointer-events: none;
    `;

    // Copy computed styles from input for accurate measurement
    // Note: computedStyle.font can return empty string in some browsers,
    // so we copy individual font properties instead
    const computedStyle = window.getComputedStyle(input);
    measureSpan.style.fontFamily = computedStyle.fontFamily;
    measureSpan.style.fontSize = computedStyle.fontSize;
    measureSpan.style.fontWeight = computedStyle.fontWeight;
    measureSpan.style.fontStyle = computedStyle.fontStyle;
    measureSpan.style.letterSpacing = computedStyle.letterSpacing;
    measureSpan.style.paddingLeft = computedStyle.paddingLeft;

    measureSpan.textContent = value || placeholder;

    // Append to body, measure, then remove
    document.body.appendChild(measureSpan);
    const textWidth = measureSpan.offsetWidth;
    document.body.removeChild(measureSpan);

    setInputWidth(Math.max(20, textWidth));
  }, [value, placeholder, tokenFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleFocus = () => {
    handleBlockFocus();
    onFocus?.();
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(e);
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
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={dispatchKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn('tsi-token-value__input', className)}
        style={{
          width: tokenFocused ? `${inputWidth}px` : 0,
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
