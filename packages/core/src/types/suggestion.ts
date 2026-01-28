import type { ReactNode } from 'react';

import type { FieldDefinition } from './fields';

export interface PaginationLabels {
  loading?: string;
  scrollForMore?: string;
}

export interface SuggestionErrorContext {
  /** Type of operation that failed */
  type: 'suggest' | 'loadMore';
  /** Query text at the time of the error */
  query: string;
}

export interface FieldSuggestionListProps {
  fields: FieldDefinition[];
  query: string;
  onSelect: (field: FieldDefinition) => void;
  activeIndex: number;
  onActiveChange: (index: number) => void;
}

export interface ValueSuggestionListProps {
  items: string[];
  query: string;
  onSelect: (value: string) => void;
  activeIndex?: number;
  onActiveChange?: (index: number) => void;
  onMouseDown?: () => void;
}

export interface SuggestedFilterToken {
  key: string;
  operator: string;
  value: string;
  /** Display label for aria-label and text operations (used when enumValues is empty/dynamic) */
  displayValue?: string;
  /**
   * Content to display before the label.
   * Not persisted across Undo/Redo with dynamic enumValues.
   * Use `displayValue` for persistent representation.
   */
  startContent?: ReactNode;
  /**
   * Content to display after the label.
   * Not persisted across Undo/Redo with dynamic enumValues.
   */
  endContent?: ReactNode;
}

export interface CustomSuggestion {
  /** Filter tokens to generate when this suggestion is selected */
  tokens: SuggestedFilterToken[];
  /** Display label (e.g., "user_id: 123, 456") */
  label: string;
  /** Optional description (e.g., "Create 2 filters") */
  description?: string;
  /** Content to display before the label in suggestion list (icon, emoji) */
  startContent?: ReactNode;
  /** Content to display after the label in suggestion list (badge, indicator) */
  endContent?: ReactNode;
}

/**
 * Display mode for custom suggestions relative to field suggestions.
 * - 'replace': Replace field suggestions when custom suggestions exist (default)
 * - 'prepend': Show custom suggestions above field suggestions
 * - 'append': Show custom suggestions below field suggestions
 */
export type CustomSuggestionDisplayMode = 'replace' | 'prepend' | 'append';

export interface ExistingToken {
  key: string;
  operator: string;
  value: string;
}

export interface SuggestContext {
  /** Current query text typed by user */
  query: string;
  /** Field definitions for the search input */
  fields: FieldDefinition[];
  /** List of existing filter tokens (for excluding already-selected values) */
  existingTokens: ExistingToken[];
}

export interface SuggestContextWithPagination extends SuggestContext {
  /** Number of items to skip (for pagination) */
  offset: number;
  /** Maximum number of items to return */
  limit: number;
}

/**
 * Result from a paginated suggestion fetch.
 */
export interface CustomSuggestionResult {
  /** Array of suggestions for current page */
  suggestions: CustomSuggestion[];
  /** Whether more items are available */
  hasMore?: boolean;
}

/**
 * Suggestion function return type.
 * Can return either a simple array or a result object with pagination info.
 */
export type SuggestFnReturn =
  | CustomSuggestion[]
  | CustomSuggestionResult
  | Promise<CustomSuggestion[]>
  | Promise<CustomSuggestionResult>;

/**
 * Configuration for custom suggestion behavior.
 */
export interface CustomSuggestionConfig {
  /**
   * Generate suggestions from input text.
   *
   * Called for every input change including empty query. Return an empty array
   * to skip showing suggestions. For expensive operations (e.g., API calls),
   * add a query length check inside the function:
   *
   * @example
   * ```typescript
   * suggest: ({ query }) => {
   *   if (query.length < 3) return []; // Skip for short queries
   *   return fetchFromAPI(query);
   * }
   * ```
   *
   * @param context - Suggestion context including query, fields, and existing tokens
   * @returns Array of suggestions, result object with hasMore, or Promise for async generation
   */
  suggest: (context: SuggestContext) => SuggestFnReturn;

  /**
   * Load more suggestions for pagination.
   * Called when user scrolls to the bottom of the suggestion list.
   * @param context - Extended context with offset and limit
   * @returns Result object with suggestions and hasMore flag
   */
  loadMore?: (context: SuggestContextWithPagination) => Promise<CustomSuggestionResult>;

  /** Debounce delay in milliseconds (default: 150) */
  debounceMs?: number;
  /** Maximum number of suggestions to display (default: 5) */
  maxSuggestions?: number;
  /** Display mode relative to field suggestions (default: 'replace') */
  displayMode?: CustomSuggestionDisplayMode;

  /**
   * Timeout for suggestion requests in milliseconds (default: 5000).
   * Requests that take longer than this will be cancelled.
   */
  timeoutMs?: number;

  /**
   * Error handler for suggestion failures (Strategy pattern).
   * Called when suggest() or loadMore() throws an error or times out.
   * Default behavior logs to console.error.
   *
   * @example
   * ```typescript
   * onError: (error, context) => {
   *   Sentry.captureException(error, { extra: context });
   * }
   * ```
   */
  onError?: (error: Error, context: SuggestionErrorContext) => void;

  /**
   * Custom selection handler. When defined, this replaces the default insert behavior.
   * Use this for toggle behavior (insert if not exists, delete if exists).
   *
   * @param suggestion - The selected suggestion
   * @param context - Context including existing tokens and editor access
   * @returns true if handled (skip default behavior), false to run default insert
   *
   * @example
   * ```typescript
   * onSelect: (suggestion, { existingTokens, deleteToken }) => {
   *   const token = suggestion.tokens[0];
   *   const existing = existingTokens.find(t => t.key === token.key && t.value === token.value);
   *   if (existing) {
   *     deleteToken(existing.id);
   *     return true; // handled, skip default insert
   *   }
   *   return false; // not handled, run default insert
   * }
   * ```
   */
  onSelect?: (suggestion: CustomSuggestion, context: CustomSuggestionSelectContext) => boolean;
}

/**
 * Context provided to onSelect callback.
 */
export interface CustomSuggestionSelectContext {
  /** List of existing filter tokens with their IDs */
  existingTokens: ExistingTokenWithId[];
  /** Delete a token by its ID */
  deleteToken: (id: string) => void;
}

/**
 * Existing token with ID for stable identification.
 * IDs are persistent across undo/redo operations.
 */
export interface ExistingTokenWithId extends ExistingToken {
  /** Unique identifier of the token */
  id: string;
}
