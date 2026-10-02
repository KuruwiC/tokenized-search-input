import { isWhitespace, readQuoted } from '../serializer/tokenize';

export interface QuoteOptions {
  /** Quote the text even when it would stand as written. */
  always?: boolean;
  /**
   * Set for text that stands as a segment of its own, such as free text. Text that starts
   * as a key followed by this delimiter would read as a filter, so it is quoted.
   */
  segmentDelimiter?: string;
}

/**
 * Writes `text` as a value or as free text of a query. Quotes are added when the text
 * contains whitespace, a quote or a backslash, or when `segmentDelimiter` is given and the
 * text starts as a key followed by that delimiter. Inside quotes, `"` and `\` are written
 * as `\"` and `\\`; every other character stays as it is.
 *
 * @example
 * quote('hello') // 'hello'
 * quote('hello world') // '"hello world"'
 * quote('say "hi"') // '"say \\"hi\\""'
 * quote('a:b', { segmentDelimiter: ':' }) // '"a:b"'
 */
export function quote(text: string, options: QuoteOptions = {}): string {
  const needed =
    options.always ||
    Array.from(text).some((char) => isWhitespace(char) || char === '"' || char === '\\') ||
    (options.segmentDelimiter !== undefined && text.indexOf(options.segmentDelimiter) > 0);
  if (!needed) return text;
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export interface Unquoted {
  value: string;
  /** Whether the text started with a quote. */
  wasQuoted: boolean;
  /** Whether the last quote the text opens is closed. */
  closed: boolean;
}

/**
 * Reads text that may be quoted. Text that does not start with a quote stands for itself.
 * Otherwise every quoted run contributes its value and the characters between runs stand
 * for themselves.
 *
 * @example
 * unquote('hello') // { value: 'hello', wasQuoted: false, closed: true }
 * unquote('"hello world"') // { value: 'hello world', wasQuoted: true, closed: true }
 * unquote('"hello') // { value: 'hello', wasQuoted: true, closed: false }
 * unquote('"say \\"hi\\""') // { value: 'say "hi"', wasQuoted: true, closed: true }
 * unquote('"a\\nb"') // { value: 'a\\nb', wasQuoted: true, closed: true }
 */
export function unquote(text: string): Unquoted {
  if (!text.startsWith('"')) return { value: text, wasQuoted: false, closed: true };
  let value = '';
  let closed = true;
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      const run = readQuoted(text, i);
      value += run.value;
      closed = run.closed;
      i = run.end;
    } else {
      value += text[i];
      i++;
    }
  }
  return { value, wasQuoted: true, closed };
}
