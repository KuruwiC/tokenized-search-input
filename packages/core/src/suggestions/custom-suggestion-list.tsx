import { useEffect, useRef } from 'react';
import type { CustomSuggestion, PaginationLabels } from '../types';
import { cn } from '../utils/cn';
import { useScrollActiveIntoView } from '../utils/scroll-into-view';

const DEFAULT_PAGINATION_LABELS: Required<PaginationLabels> = {
  loading: 'Loading...',
  scrollForMore: 'Scroll for more',
};

interface CustomSuggestionListProps {
  items: readonly CustomSuggestion[];
  onSelect: (suggestion: CustomSuggestion) => void;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  className?: string;
  /** Custom class name for each suggestion item */
  itemClassName?: string;
  /** Custom class name for suggestion description */
  descriptionClassName?: string;
  /** Whether more items can be loaded */
  hasMore?: boolean;
  /** Whether loadMore is currently in progress */
  isLoadingMore?: boolean;
  /** Callback to load more items */
  onLoadMore?: () => void;
  /** Labels for pagination UI */
  paginationLabels?: PaginationLabels;
}

export const CustomSuggestionList: React.FC<CustomSuggestionListProps> = ({
  items,
  onSelect,
  activeIndex,
  onActiveChange,
  className,
  itemClassName,
  descriptionClassName,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  paginationLabels,
}) => {
  const labels = { ...DEFAULT_PAGINATION_LABELS, ...paginationLabels };
  const itemRefs = useScrollActiveIntoView<HTMLDivElement>(activeIndex);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isLoadingMore) {
      loadMoreTriggeredRef.current = false;
    }
  }, [isLoadingMore]);

  useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore || !loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadMoreTriggeredRef.current) {
          loadMoreTriggeredRef.current = true;
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Render nothing only when no items AND no more to load
  if (items.length === 0 && !hasMore) {
    return null;
  }

  return (
    <div
      role="listbox"
      aria-label="Custom suggestions"
      className={cn('tsi-suggestion-list', className)}
    >
      {items.map((item, index) => {
        const isActive = index === activeIndex;

        return (
          <div
            key={`${item.label}-${index}`}
            ref={(el) => {
              if (el) itemRefs.current.set(index, el);
              else itemRefs.current.delete(index);
            }}
            role="option"
            tabIndex={-1}
            aria-selected={isActive}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(item);
              }
            }}
            onMouseEnter={() => onActiveChange(index)}
            data-active={isActive}
            className={cn('tsi-custom-suggestion-item', itemClassName)}
          >
            <span className="tsi-custom-suggestion-item__label" title={item.label}>
              {item.startContent && <span className="tsi-icon-slot">{item.startContent}</span>}
              {item.label}
              {item.endContent && <span className="tsi-icon-slot">{item.endContent}</span>}
            </span>
            {item.description && (
              <span
                className={cn('tsi-custom-suggestion-item__description', descriptionClassName)}
                title={item.description}
              >
                {item.description}
              </span>
            )}
          </div>
        );
      })}
      {hasMore && (
        <div ref={loadMoreRef} className="tsi-load-more">
          {isLoadingMore ? labels.loading : labels.scrollForMore}
        </div>
      )}
    </div>
  );
};
