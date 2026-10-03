import { quote } from '../utils/quoted-string';
import type { FieldResolutionSource } from '../utils/resolve-field';
import { readsAsFilter } from './read-word';

/** A filter token as a segment of a query, or `null` for a token without a value. */
export function filterSegment(
  token: { key?: unknown; operator?: unknown; value?: unknown },
  delimiter: string
): string | null {
  const value = String(token.value || '');
  if (!value) return null;
  return `${token.key}${delimiter}${token.operator}${delimiter}${quote(value)}`;
}

/**
 * A free text token as a segment of a query, or `null` for a token without a value. With
 * `source`, free text that would read as a filter is quoted; without it nothing is known
 * to be a field, so that is left as written.
 */
export function freeTextSegment(
  token: { value?: unknown; quoted?: unknown },
  delimiter: string,
  source?: FieldResolutionSource
): string | null {
  const value = String(token.value || '');
  // The parser drops free text that is only whitespace, so it is not written.
  if (!value.trim()) return null;
  const always =
    Boolean(token.quoted) || (source !== undefined && readsAsFilter(value, source, delimiter));
  return quote(value, { always });
}

/** Document text as a segment of a query, or `null` when only spaces are left. */
export function textSegment(text: string | undefined): string | null {
  return trimSpaces(text ?? '') || null;
}

/** The query as written, without the spaces at its edges. Other whitespace belongs to a value. */
export function trimSpaces(query: string): string {
  return query.replace(/^ +| +$/g, '');
}
