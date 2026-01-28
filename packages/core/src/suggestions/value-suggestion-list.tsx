import { Check } from 'lucide-react';
import type { EnumValue } from '../types';
import { cn } from '../utils/cn';
import { getEnumIcon, getEnumLabel, getEnumValue } from '../utils/enum-value';
import { useScrollActiveIntoView } from '../utils/scroll-into-view';

interface ValueSuggestionListProps {
  items: EnumValue[];
  currentValue?: string;
  onSelect: (value: string) => void;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  className?: string;
  /** Custom class for suggestion items */
  itemClassName?: string;
}

export const ValueSuggestionList: React.FC<ValueSuggestionListProps> = ({
  items,
  currentValue,
  onSelect,
  activeIndex,
  onActiveChange,
  className,
  itemClassName,
}) => {
  const itemRefs = useScrollActiveIntoView<HTMLDivElement>(activeIndex);
  // items is already filtered by filter-token-view, no need to filter again
  if (items.length === 0) {
    return <div className="tsi-no-results">No matching values</div>;
  }

  return (
    <div
      role="listbox"
      aria-label="Value suggestions"
      className={cn('tsi-suggestion-list', className)}
    >
      {items.map((item, index) => {
        const value = getEnumValue(item);
        const displayValue = getEnumLabel(item);
        const icon = getEnumIcon(item);
        const isSelected = value === currentValue;
        return (
          <div
            key={value}
            ref={(el) => {
              if (el) itemRefs.current.set(index, el);
              else itemRefs.current.delete(index);
            }}
            role="option"
            tabIndex={-1}
            aria-selected={index === activeIndex}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(value);
              }
            }}
            onMouseEnter={() => onActiveChange(index)}
            data-active={index === activeIndex}
            className={cn('tsi-suggestion-item', itemClassName)}
          >
            <span className="tsi-value-check">
              {isSelected && <Check className="tsi-value-check-icon" />}
            </span>
            <span className="tsi-value-label" title={displayValue}>
              {icon && <span className="tsi-icon-slot">{icon}</span>}
              {displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
};
