import type { FieldDefinition } from '../types';
import { cn } from '../utils/cn';

interface FieldSuggestionItemProps {
  field: FieldDefinition;
  iconClassName?: string;
  hintClassName?: string;
}

/** What an option of a field suggestion shows. */
export const FieldSuggestionItem: React.FC<FieldSuggestionItemProps> = ({
  field,
  iconClassName,
  hintClassName,
}) => (
  <>
    {field.icon && <span className={cn('tsi-field-icon', iconClassName)}>{field.icon}</span>}
    <span className="tsi-field-label" title={field.label}>
      {field.label}
    </span>
    {field.hint && <span className={cn('tsi-field-hint', hintClassName)}>{field.hint}</span>}
    <span className={cn('tsi-field-key', hintClassName)} title={field.key}>
      {field.key}
    </span>
  </>
);
