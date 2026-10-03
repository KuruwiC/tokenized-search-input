import { quote } from '../utils/quoted-string';

/** A filter token as a segment of a query, or `null` for a token without a value. */
export function filterSegment(
  token: { key?: unknown; operator?: unknown; value?: unknown },
  delimiter: string
): string | null {
  const value = String(token.value || '');
  if (!value) return null;
  return `${token.key}${delimiter}${token.operator}${delimiter}${quote(value)}`;
}

/** A free text token as a segment of a query, or `null` for a token without a value. */
export function freeTextSegment(
  token: { value?: unknown; quoted?: unknown },
  delimiter: string
): string | null {
  const value = String(token.value || '');
  // The parser drops free text that is only whitespace, so it is not written.
  if (!value.trim()) return null;
  return quote(value, { always: Boolean(token.quoted), segmentDelimiter: delimiter });
}

/** Text of the document as a segment of a query: without the spaces around it, or `null` when nothing is left. */
export function textSegment(text: string | undefined): string | null {
  return text?.replace(/^ +| +$/g, '') || null;
}

/** The query as written, without the spaces at its edges. Other whitespace belongs to a value. */
export function trimSpaces(query: string): string {
  return query.replace(/^ +| +$/g, '');
}
