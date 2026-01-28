import type { FieldDefinition } from '../../../../types';
import { cn } from '../../../../utils/cn';

export interface TokenLabelProps {
  field?: FieldDefinition;
  fallback?: string;
  className?: string;
}

/**
 * Token label block (not focusable).
 * Displays the field label with optional icon.
 */
export function TokenLabel({ field, fallback, className }: TokenLabelProps): React.ReactElement {
  const label = field?.label || fallback || '';
  const hasIcon = !!field?.icon;
  const tokenLabelDisplay = field?.tokenLabelDisplay ?? 'auto';

  // 'icon-only' without icon falls back to showing text
  const showText = tokenLabelDisplay === 'auto' || (tokenLabelDisplay === 'icon-only' && !hasIcon);

  return (
    <span className={cn('tsi-token-label', className)}>
      {hasIcon && <span className="tsi-token-label__icon">{field.icon}</span>}
      {showText && <span className="tsi-token-label__text">{label}</span>}
    </span>
  );
}
