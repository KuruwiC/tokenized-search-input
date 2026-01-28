import type { FieldDefinition } from '../types';
import { cn } from '../utils/cn';
import { useScrollActiveIntoView } from '../utils/scroll-into-view';

interface FieldSuggestionListProps {
  fields: FieldDefinition[];
  onSelect: (field: FieldDefinition) => void;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  className?: string;
  /** Custom class for suggestion items */
  itemClassName?: string;
  /** Custom class for hint/key text (secondary info) */
  hintClassName?: string;
  /** Custom class for field icon */
  iconClassName?: string;
  /** Custom class for category headers */
  categoryClassName?: string;
}

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

export const FieldSuggestionList: React.FC<FieldSuggestionListProps> = ({
  fields,
  onSelect,
  activeIndex,
  onActiveChange,
  className,
  itemClassName,
  hintClassName,
  iconClassName,
  categoryClassName,
}) => {
  const groups = groupFieldsByCategory(fields);
  const hasMultipleCategories =
    groups.length > 1 || (groups.length === 1 && groups[0].category !== DEFAULT_CATEGORY);
  const itemRefs = useScrollActiveIntoView<HTMLDivElement>(activeIndex);

  if (fields.length === 0) {
    return null;
  }

  // Track flat index across groups for keyboard navigation
  let flatIndex = 0;

  return (
    <div
      role="listbox"
      aria-label="Available filter fields"
      className={cn('tsi-suggestion-list', className)}
    >
      {groups.map((group, groupIndex) => (
        <fieldset key={group.category}>
          {hasMultipleCategories && (
            <div
              className={cn(
                'tsi-field-category',
                groupIndex > 0 && 'tsi-field-category--separated',
                categoryClassName
              )}
              aria-hidden="true"
            >
              {group.category}
            </div>
          )}
          {group.fields.map((field, fieldIndex) => {
            const currentIndex = flatIndex;
            flatIndex++;
            const isActive = currentIndex === activeIndex;
            const isFirstInGroup = fieldIndex === 0 && hasMultipleCategories;

            return (
              <div
                key={field.key}
                ref={(el) => {
                  if (el) itemRefs.current.set(currentIndex, el);
                  else itemRefs.current.delete(currentIndex);
                }}
                role="option"
                tabIndex={-1}
                aria-selected={isActive}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(field)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(field);
                  }
                }}
                onMouseEnter={() => onActiveChange(currentIndex)}
                data-active={isActive}
                style={isFirstInGroup ? { scrollMarginTop: '2rem' } : undefined}
                className={cn('tsi-suggestion-item', itemClassName)}
              >
                {field.icon && (
                  <span className={cn('tsi-field-icon', iconClassName)}>{field.icon}</span>
                )}
                <span className="tsi-field-label" title={field.label}>
                  {field.label}
                </span>
                {field.hint && (
                  <span className={cn('tsi-field-hint', hintClassName)}>{field.hint}</span>
                )}
                <span className={cn('tsi-field-key', hintClassName)} title={field.key}>
                  {field.key}
                </span>
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
};
