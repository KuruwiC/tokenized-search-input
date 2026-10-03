import { readQuoted } from '../serializer/tokenize';

/** What makes text need quotes: any whitespace character (space, tab, CR, LF), a quote or a backslash. */
const NEEDS_QUOTES = /[ \t\r\n"\\]/;

export interface QuoteOptions {
  /** Quote the text even when it would stand as written. */
  always?: boolean;
}

/**
 * Writes `text` as a value or as free text of a query. Quotes are added when the text
 * contains whitespace, a quote or a backslash, or when `always` is set. Inside quotes, `"`
 * and `\` are written as `\"` and `\\`; every other character stays as it is.
 *
 * @example
 * quote('hello') // 'hello'
 * quote('hello world') // '"hello world"'
 * quote('say "hi"') // '"say \\"hi\\""'
 * quote('a', { always: true }) // '"a"'
 */
export function quote(text: string, options: QuoteOptions = {}): string {
  if (!options.always && !NEEDS_QUOTES.test(text)) return text;
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
