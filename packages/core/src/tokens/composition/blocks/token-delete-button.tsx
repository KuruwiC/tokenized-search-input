import { X } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '../../../utils/cn';
import { useTokenConfig, useTokenFocusContext } from '../contexts';
import { useFocusableBlock } from '../focus';
import { HandlerPriority, useBlockKeyboardContribution } from '../keyboard';

export interface TokenDeleteButtonProps {
  ariaLabel?: string;
  className?: string;
}

/**
 * Token delete button block (focusable).
 * Removes the token when clicked or activated.
 *
 * Keyboard handling is registered via useBlockKeyboardContribution.
 */
export function TokenDeleteButton({
  ariaLabel = 'Remove token',
  className = '',
}: TokenDeleteButtonProps): React.ReactElement {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { deleteToken } = useTokenConfig();
  const { currentFocusId, dispatchKeyDown, isEditable } = useTokenFocusContext();

  const { navigateLeft, navigateRight, navigateLeftEntry, navigateRightEntry, tabIndex } =
    useFocusableBlock({
      id: 'delete',
      ref: buttonRef,
      entryFocusable: false,
    });

  const keyboardHandlers = {
    ArrowLeft: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'delete') return false;
        e.preventDefault();
        navigateLeft();
        return true;
      },
      priority: HandlerPriority.DEFAULT,
    },
    ArrowRight: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'delete') return false;
        e.preventDefault();
        navigateRight();
        return true;
      },
      priority: HandlerPriority.DEFAULT,
    },
    Enter: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'delete') return false;
        e.preventDefault();
        e.stopPropagation();
        deleteToken();
        return true;
      },
      priority: HandlerPriority.DEFAULT,
    },
    ' ': {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'delete') return false;
        e.preventDefault();
        e.stopPropagation();
        deleteToken();
        return true;
      },
      priority: HandlerPriority.DEFAULT,
    },
    Backspace: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'delete') return false;
        e.preventDefault();
        navigateLeftEntry();
        return true;
      },
      priority: HandlerPriority.DEFAULT,
    },
    Delete: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'delete') return false;
        e.preventDefault();
        navigateRightEntry();
        return true;
      },
      priority: HandlerPriority.DEFAULT,
    },
  };

  useBlockKeyboardContribution('delete', keyboardHandlers);

  // Click handler (works for both desktop and mobile)
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteToken();
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      onKeyDown={dispatchKeyDown}
      onMouseDown={(e) => e.preventDefault()}
      className={cn('tsi-token-delete', className)}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      data-editable={isEditable}
    >
      <X className="tsi-token-delete__icon" />
    </button>
  );
}
