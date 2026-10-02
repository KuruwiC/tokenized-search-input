import { useRef } from 'react';
import { X } from '../../../icons/x';
import { cn } from '../../../utils/cn';
import { useTokenConfig } from '../contexts/token-config-context';
import { useTokenFocusContext } from '../contexts/token-focus-context';
import { useFocusableBlock } from '../focus';

export interface TokenDeleteButtonProps {
  ariaLabel?: string;
  className?: string;
}

/**
 * Token delete button block (focusable).
 * Removes the token when clicked or activated.
 */
export function TokenDeleteButton({
  ariaLabel = 'Remove token',
  className = '',
}: TokenDeleteButtonProps): React.ReactElement {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { deleteToken } = useTokenConfig();
  const { isEditable } = useTokenFocusContext();

  const handleKey = (e: React.KeyboardEvent): boolean => {
    switch (e.key) {
      case 'ArrowLeft':
        navigateLeft();
        break;
      case 'ArrowRight':
        navigateRight();
        break;
      case 'Enter':
      case ' ':
        deleteToken();
        break;
      case 'Backspace':
        navigateLeftEntry();
        break;
      case 'Delete':
        navigateRightEntry();
        break;
      default:
        return false;
    }
    e.preventDefault();
    return true;
  };

  const {
    navigateLeft,
    navigateRight,
    navigateLeftEntry,
    navigateRightEntry,
    tabIndex,
    handleFocus,
  } = useFocusableBlock({
    id: 'delete',
    ref: buttonRef,
    entryFocusable: false,
    handleKey,
  });

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
      onFocus={handleFocus}
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
