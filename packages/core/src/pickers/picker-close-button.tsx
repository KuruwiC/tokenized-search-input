import type { FC, ReactNode } from 'react';
import { Check } from '../icons/check';
import { closeButtonClassName } from './calendar-styles';

const FALLBACK_NAME = 'Close';

interface PickerCloseButtonProps {
  label: ReactNode | undefined;
  onClose: () => void;
}

/**
 * Footer button that closes a default picker. A label that may not be text, the default
 * icon included, gets a title as the fallback accessible name.
 */
export const PickerCloseButton: FC<PickerCloseButtonProps> = ({ label, onClose }) => {
  const isText = typeof label === 'string' || typeof label === 'number';
  return (
    <div className="tsi-picker-footer">
      <button
        type="button"
        onClick={onClose}
        className={closeButtonClassName}
        title={isText ? undefined : FALLBACK_NAME}
      >
        {label ?? <Check className="tsi-picker-close-btn__icon" />}
      </button>
    </div>
  );
};
