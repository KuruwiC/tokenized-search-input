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
 * Removes the token when pressed or activated from the keyboard, including with
 * Backspace and Delete. A press is recognised by the token, which calls the block's
 * `activate`.
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
      case 'Backspace':
      case 'Delete':
        deleteToken();
        break;
      default:
        return false;
    }
    e.preventDefault();
    return true;
  };

  const { navigateLeft, navigateRight, tabIndex, blockProps } = useFocusableBlock({
    id: 'delete',
    ref: buttonRef,
    entryFocusable: false,
    editsToken: false,
    handleKey,
    activate: deleteToken,
  });

  return (
    <button
      ref={buttonRef}
      type="button"
      {...blockProps}
      tabIndex={tabIndex}
      onMouseDown={(e) => e.preventDefault()}
      className={cn('tsi-token-delete', className)}
      aria-label={ariaLabel}
      data-editable={isEditable}
    >
      <X className="tsi-token-delete__icon" />
    </button>
  );
}
