import type { FieldDefinition } from '../types';
import { cn } from '../utils/cn';

interface FieldGroup {
  category: string;
  fields: FieldDefinition[];
}

const DEFAULT_CATEGORY = 'Other';

/**
 * Group fields by category for display.
 * Categories are displayed in order of first appearance, with "Other" moved to end.
 */
export function groupFieldsByCategory(fields: FieldDefinition[]): FieldGroup[] {
  const categoryMap = new Map<string, FieldDefinition[]>();
  const categoryOrder: string[] = [];

  for (const field of fields) {
    const category = field.category || DEFAULT_CATEGORY;
    const existing = categoryMap.get(category);
    if (existing) {
      existing.push(field);
    } else {
      categoryMap.set(category, [field]);
      categoryOrder.push(category);
    }
  }

  // Move "Other" category to end if it exists
  const otherIndex = categoryOrder.indexOf(DEFAULT_CATEGORY);
  if (otherIndex !== -1 && otherIndex !== categoryOrder.length - 1) {
    categoryOrder.splice(otherIndex, 1);
    categoryOrder.push(DEFAULT_CATEGORY);
  }

  return categoryOrder.map((category) => ({
    category,
    fields: categoryMap.get(category) ?? [],
  }));
}

/**
 * Get fields in display order after category grouping.
 * This order matches the visual order in the suggestion list.
 */
export function getFieldsInDisplayOrder(fields: FieldDefinition[]): FieldDefinition[] {
  const groups = groupFieldsByCategory(fields);
  return groups.flatMap((group) => group.fields);
}

/** Whether the categories of the fields are worth naming: more than the default one. */
export function hasCategoryHeaders(groups: FieldGroup[]): boolean {
  return groups.length > 1 || (groups.length === 1 && groups[0].category !== DEFAULT_CATEGORY);
}

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
