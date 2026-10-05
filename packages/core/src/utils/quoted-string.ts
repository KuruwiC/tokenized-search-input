import { readQuoted } from '../serializer/tokenize';

/** Characters that force quoting: space, tab, CR, LF, a quote and a backslash. */
const NEEDS_QUOTES = /[ \t\r\n"\\]/;

export interface QuoteOptions {
  always?: boolean;
}

/**
 * Writes `text` as a value or as free text of a query. Quotes are added when the text
 * contains a space, tab, CR, LF, quote or backslash, or when `always` is set. Inside quotes,
 * `"` and `\` are written as `\"` and `\\`; every other character stays as it is.
 */
export function quote(text: string, options: QuoteOptions = {}): string {
  if (!options.always && !NEEDS_QUOTES.test(text)) return text;
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export interface Unquoted {
  value: string;
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
 * unquote('"hello') // { value: 'hello', wasQuoted: true, closed: false }
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
