import { useEffect, useRef } from 'react';
import type { CustomSuggestion, PaginationLabels } from '../types';
import { cn } from '../utils/cn';

const DEFAULT_PAGINATION_LABELS: Required<PaginationLabels> = {
  loading: 'Loading...',
  scrollForMore: 'Scroll for more',
};

interface CustomSuggestionItemProps {
  suggestion: CustomSuggestion;
  descriptionClassName?: string;
}

export const CustomSuggestionItem: React.FC<CustomSuggestionItemProps> = ({
  suggestion,
  descriptionClassName,
}) => (
  <>
    <span className="tsi-custom-suggestion-item__label" title={suggestion.label}>
      {suggestion.startContent && <span className="tsi-icon-slot">{suggestion.startContent}</span>}
      {suggestion.label}
      {suggestion.endContent && <span className="tsi-icon-slot">{suggestion.endContent}</span>}
    </span>
    {suggestion.description && (
      <span
        className={cn('tsi-custom-suggestion-item__description', descriptionClassName)}
        title={suggestion.description}
      >
        {suggestion.description}
      </span>
    )}
  </>
);

interface CustomSuggestionLoadMoreProps {
  isLoadingMore: boolean;
  onLoadMore: () => void;
  labels?: PaginationLabels;
}

/** The row below the custom suggestions that asks for the next page once it scrolls into view. */
export const CustomSuggestionLoadMore: React.FC<CustomSuggestionLoadMoreProps> = ({
  isLoadingMore,
  onLoadMore,
  labels,
}) => {
  const text = { ...DEFAULT_PAGINATION_LABELS, ...labels };
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    if (isLoadingMore || !row) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(row);
    return () => observer.disconnect();
  }, [isLoadingMore, onLoadMore]);

  return (
    <div ref={rowRef} className="tsi-load-more">
      {isLoadingMore ? text.loading : text.scrollForMore}
    </div>
  );
};
