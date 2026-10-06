import { useCallback, useLayoutEffect, useRef } from 'react';
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
  /**
   * Writes the edited text to the document and returns the document's text to show after it.
   * `composing` is set while an input method is still composing the text.
   */
  onChange: (value: string, composing: boolean) => string;
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
 * Maps offsets in `from` to the same place in `to`, the change read as one replaced span.
 * An offset at or inside the span lands after its replacement, as a caret does after typing.
 */
function offsetMapping(from: string, to: string): (offset: number) => number {
  const shorter = Math.min(from.length, to.length);
  let prefix = 0;
  while (prefix < shorter && from[prefix] === to[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < shorter - prefix &&
    from[from.length - 1 - suffix] === to[to.length - 1 - suffix]
  ) {
    suffix++;
  }
  const replacedEnd = from.length - suffix;
  const replacementEnd = to.length - suffix;
  return (offset) => {
    if (offset < prefix) return offset;
    if (offset >= replacedEnd) return offset - replacedEnd + replacementEnd;
    return replacementEnd;
  };
}

/**
 * Writes `text` into the input only where the input shows something else, so text the
 * input already shows keeps its caret and selection. Setting the value moves the caret to
 * the end, so the selection is mapped to the same place in `text`.
 */
function showText(input: HTMLInputElement | null, text: string): void {
  if (!input || input.value === text) return;
  const shown = input.value;
  const { selectionStart, selectionEnd, selectionDirection } = input;
  input.value = text;
  if (input.ownerDocument.activeElement !== input) return;
  if (selectionStart === null || selectionEnd === null) return;
  const map = offsetMapping(shown, text);
  input.setSelectionRange(map(selectionStart), map(selectionEnd), selectionDirection ?? undefined);
}

/** The input stays mounted while the token is not edited, out of the layout and out of reach. */
const HIDDEN_FIELD: React.CSSProperties = {
  position: 'absolute',
  width: 0,
  minWidth: 0,
  overflow: 'hidden',
  opacity: 0,
  pointerEvents: 'none',
};

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

  // A node view also renders with the props of its previous node before the transaction
  // reaches it; showText leaves the input alone for such a render.
  useLayoutEffect(() => {
    showText(inputRef.current, value);
  }, [value]);

  // Shown here rather than by the effect: reading an operator out of an empty value leaves
  // the `value` prop unchanged. Writing into the input while an input method composes would
  // commit its text early; the committed text arrives in a later input event or compositionend.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const composing =
      e.nativeEvent instanceof InputEvent && e.nativeEvent.inputType === 'insertCompositionText';
    const shown = onChange(e.target.value, composing);
    if (!composing) showText(e.target, shown);
  };
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    showText(e.currentTarget, onChange(e.currentTarget.value, false));
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
      <span className="tsi-token-value__field" style={showsControls ? undefined : HIDDEN_FIELD}>
        {/* Sizes the input: the same text in the same grid cell, with the token's text styles */}
        {showsControls && (
          <span className={cn('tsi-token-value__mirror', className)} aria-hidden="true">
            {value || placeholder}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          data-token-block={blockProps['data-token-block']}
          onChange={handleChange}
          onCompositionEnd={handleCompositionEnd}
          onFocus={handleFocus}
          className={cn('tsi-token-value__input', className)}
          placeholder={showsControls ? placeholder : undefined}
          aria-label={showsControls ? ariaLabel : undefined}
          tabIndex={showsControls ? tabIndex : -1}
          aria-hidden={!showsControls}
          autoComplete="off"
          spellCheck={false}
        />
      </span>
    </span>
  );
}
