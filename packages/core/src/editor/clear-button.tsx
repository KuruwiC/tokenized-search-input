import { X } from 'lucide-react';
import { cn } from '../utils/cn';

export interface ClearButtonProps {
  onClick: () => void;
  visible: boolean;
  disabled?: boolean;
  className?: string;
  /**
   * When true, render as inline element (for single-line scroll mode).
   * When false (default), render as absolute positioned element.
   */
  inline?: boolean;
}

export function ClearButton({
  onClick,
  visible,
  disabled,
  className,
  inline = false,
}: ClearButtonProps) {
  const isInteractive = visible && !disabled;

  return (
    <button
      type="button"
      onClick={isInteractive ? onClick : undefined}
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={cn(
        'tsi-clear-button',
        inline ? 'tsi-clear-button--inline' : 'tsi-clear-button--absolute',
        !visible && 'tsi-clear-button--hidden',
        visible && !disabled && 'tsi-clear-button--visible',
        visible && disabled && 'tsi-clear-button--disabled',
        isInteractive && 'tsi-clear-button--interactive',
        className
      )}
      aria-label="Clear search"
      tabIndex={isInteractive ? 0 : -1}
      aria-hidden={!visible}
    >
      <X className="tsi-clear-button__icon" strokeWidth={2} />
    </button>
  );
}
