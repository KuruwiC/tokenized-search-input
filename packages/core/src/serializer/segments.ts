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
  if (!value) return null;
  return quote(value, { always: Boolean(token.quoted), segmentDelimiter: delimiter });
}
