import { useCallback, useLayoutEffect, useRef } from 'react';
import { useTextWidth } from '../../../hooks/use-text-width';
import { cn } from '../../../utils/cn';
import {
  type BlockFocusOptions,
  type CursorPosition,
  useTokenFocusContext,
} from '../contexts/token-focus-context';
import { focusElement, useFocusableBlock } from '../focus';

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
  /** Writes the text the user edited to the document; false when the document did not change. */
  onChange: (value: string) => boolean;
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
 * Writes `text` into the input only where the input shows something else, so text the
 * input already shows keeps its caret and selection.
 */
function showText(input: HTMLInputElement | null, text: string): void {
  if (input && input.value !== text) input.value = text;
}

/**
 * Token value input block (focusable).
 * Auto-sizing text input for token values.
 *
 * The document owns the value and the input owns the caret. The input is not a React
 * controlled input: a node view re-renders only after the edit's transaction, so React
 * would write the old value back into the input and then the new one, moving the caret
 * to the end on every edit. Instead the input's text is the user's edit, and the
 * document's text is written into it only where the two differ.
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
  const { showsControls, exitToken, currentFocusId } = useTokenFocusContext();

  const focusInput = useCallback((position?: CursorPosition, options?: BlockFocusOptions) => {
    if (inputRef.current) focusElement(inputRef.current, position ?? 'end', options);
  }, []);

  const handleKey = (e: React.KeyboardEvent): boolean => {
    if (handleViewKey?.(e)) return true;

    const input = inputRef.current;
    if (!input) return false;
    const caret = input.selectionStart ?? 0;
    const collapsed = caret === (input.selectionEnd ?? 0);
    const atStart = caret === 0;
    const atEnd = caret === input.value.length;

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
        if (!atStart || !collapsed) return false;
        e.preventDefault();
        navigateLeftEntry();
        return true;
      case 'Delete':
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
    blockProps,
  } = useFocusableBlock({
    id: 'value',
    ref: inputRef,
    focus: focusInput,
    handleKey,
  });

  const inputWidth = useTextWidth(inputRef, value || placeholder, showsControls);

  useLayoutEffect(() => {
    showText(inputRef.current, value);
  }, [value]);

  // An edit the document does not take leaves the document's text in the input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onChange(e.target.value)) showText(e.target, value);
  };

  const handleFocus = () => {
    blockProps.onFocus();
    onFocus?.();
  };

  const isValueFocused = showsControls && currentFocusId === 'value';

  // Render both span and input to avoid DOM remount flickering
  return (
    <span className={cn('tsi-token-value', containerClassName)} data-focused={isValueFocused}>
      {!showsControls && (
        <span className={cn('tsi-token-value__display', className)}>
          <TokenIconSlot>{startContent}</TokenIconSlot>
          <span className="tsi-token-value__display-text">{value || placeholder}</span>
          <TokenIconSlot>{endContent}</TokenIconSlot>
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        data-token-block={blockProps['data-token-block']}
        onChange={handleChange}
        onFocus={handleFocus}
        className={cn('tsi-token-value__input', className)}
        style={{
          width: showsControls ? inputWidth : 0,
          maxWidth: showsControls ? '100%' : undefined,
          opacity: showsControls ? 1 : 0,
          position: showsControls ? 'relative' : 'absolute',
          pointerEvents: showsControls ? 'auto' : 'none',
        }}
        placeholder={showsControls ? placeholder : undefined}
        aria-label={showsControls ? ariaLabel : undefined}
        tabIndex={showsControls ? tabIndex : -1}
        aria-hidden={!showsControls}
        autoComplete="off"
        spellCheck={false}
      />
    </span>
  );
}
