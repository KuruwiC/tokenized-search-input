/**
 * Default delimiter character used to separate field, operator, and value in tokens.
 * Format: `field:operator:value` (e.g., `status:is:active`)
 *
 * @remarks
 * - Must be a single character
 * - Changing the delimiter after editor initialization may cause synchronization issues
 */
export const DEFAULT_TOKEN_DELIMITER = ':';

export type TokenState = 'editing' | 'confirmed';

/**
 * Controls how free text (non-filter text) is handled.
 *
 * | Mode       | On Space/Enter | On Blur/Submit | Query Output |
 * |------------|----------------|----------------|--------------|
 * | 'none'     | Kept as text   | Auto-deleted   | Filters only |
 * | 'plain'    | Kept as text   | Kept as text   | Mixed        |
 * | 'tokenize' | Creates tag    | Creates tag    | Mixed        |
 *
 * @example
 * // 'none' - Search filters only, no free text
 * <TokenizedSearchInput freeTextMode="none" />
 *
 * // 'plain' - Allow free text search terms
 * <TokenizedSearchInput freeTextMode="plain" />
 *
 * // 'tokenize' - Visual tags for all input
 * <TokenizedSearchInput freeTextMode="tokenize" />
 */
export type FreeTextMode = 'none' | 'plain' | 'tokenize';

export interface FilterToken {
  type: 'filter';
  key: string;
  operator: string;
  value: string;
  invalid?: boolean;
}

export interface FreeTextToken {
  type: 'freeText';
  value: string;
}

export type ParsedToken = FilterToken | FreeTextToken;

export interface FilterTokenAttrs {
  key: string;
  operator: string;
  value: string;
  invalid?: boolean;
  invalidReason?: string;
}

/**
 * Filter token in a query snapshot.
 * Contains field, operator, and value for structured search filters.
 */
export interface QuerySnapshotFilterToken {
  /**
   * Unique identifier for this token.
   * IDs are persistent UUIDs stored in the editor document.
   * They remain stable across onChange callbacks and undo/redo operations.
   */
  readonly id: string;
  /** Token type discriminator */
  readonly type: 'filter';
  /** Field key */
  readonly key: string;
  /** Operator */
  readonly operator: string;
  /** Token value */
  readonly value: string;
  /** Whether the token failed validation */
  readonly invalid?: boolean;
  /** Reason for validation failure */
  readonly invalidReason?: string;
}

/**
 * Free text token in a query snapshot.
 * Created when `freeTextMode='tokenize'` - text is converted to visual tokens.
 */
export interface QuerySnapshotFreeTextToken {
  /**
   * Unique identifier for this token.
   * IDs are persistent UUIDs stored in the editor document,
   * stable across onChange callbacks and undo/redo operations.
   */
  readonly id: string;
  /** Segment type discriminator */
  readonly type: 'freeText';
  /** Token value */
  readonly value: string;
}

/**
 * Plain text segment in a query snapshot.
 * Created when `freeTextMode='plain'` - text is kept as-is without tokenization.
 *
 * Unlike tokens, plain text segments do not have IDs because they are not
 * stored as discrete nodes in the editor.
 */
export interface QuerySnapshotPlainText {
  /** Segment type discriminator */
  readonly type: 'plaintext';
  /** Text content */
  readonly value: string;
}

/**
 * Segment in a query snapshot.
 * Use type narrowing to access type-specific properties:
 *
 * @example
 * ```typescript
 * snapshot.segments.forEach(segment => {
 *   switch (segment.type) {
 *     case 'filter':
 *       console.log(`Filter: ${segment.key}=${segment.value} (id: ${segment.id})`);
 *       break;
 *     case 'freeText':
 *       console.log(`FreeText: ${segment.value} (id: ${segment.id})`);
 *       break;
 *     case 'plaintext':
 *       console.log(`PlainText: ${segment.value}`);
 *       break;
 *   }
 * });
 * ```
 */
export type QuerySnapshotSegment =
  | QuerySnapshotFilterToken
  | QuerySnapshotFreeTextToken
  | QuerySnapshotPlainText;

/**
 * Query snapshot for stable callback payloads.
 *
 * This type is designed for forward compatibility:
 * - New optional fields can be added without breaking existing code
 *
 * @example
 * ```typescript
 * onSubmit={(snapshot) => {
 *   console.log(snapshot.text); // "status:is:active user:is:john"
 *   console.log(snapshot.segments); // Array of segments
 * }}
 * ```
 */
export interface QuerySnapshot {
  /** Parsed segments (tokens and plain text) */
  readonly segments: ReadonlyArray<QuerySnapshotSegment>;

  /** Serialized query string */
  readonly text: string;
}
