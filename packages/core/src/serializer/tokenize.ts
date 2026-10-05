import { readQuoted } from './quoted-string';

/** The one character that ends a segment of a query when it is outside quotes. */
function isSeparator(char: string): boolean {
  return char === ' ';
}

/** A segment that is one quoted run: free text written in quotes. */
interface QuotedSegment {
  type: 'quoted';
  /** The segment as written, quotes and escapes included. */
  raw: string;
  value: string;
  closed: boolean;
}

/** A segment without a leading quote: a filter, or free text. */
interface WordSegment {
  type: 'word';
  /** The segment as written, quotes and escapes included. */
  raw: string;
  /** The text before the first delimiter, or `null` when the word holds none. */
  key: string | null;
  /** The text after the first delimiter; the whole word when it holds none. */
  rest: string;
  /** Whether every quote the word opens is closed. */
  closed: boolean;
}

export type Segment = QuotedSegment | WordSegment;

/** Splits the text of a word at its first delimiter into the key and what follows it. */
export function splitAtDelimiter(
  raw: string,
  delimiter: string
): { key: string | null; rest: string } {
  const at = raw.indexOf(delimiter);
  return at < 0 ? { key: null, rest: raw } : { key: raw.slice(0, at), rest: raw.slice(at + 1) };
}

/**
 * Cuts a query into segments. A space outside quotes separates them; a tab, a carriage
 * return or a newline is an ordinary character. A segment that starts with a quote ends at
 * its closing quote; any other segment runs until a space, and a quote inside it opens a
 * run that can hold spaces. A quote left open runs to the end of the text.
 */
export function tokenizeQuery(text: string, delimiter: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  while (i < text.length) {
    if (isSeparator(text[i])) {
      i++;
      continue;
    }
    const start = i;
    if (text[i] === '"') {
      const run = readQuoted(text, i);
      segments.push({
        type: 'quoted',
        raw: text.slice(start, run.end),
        value: run.value,
        closed: run.closed,
      });
      i = run.end;
      continue;
    }
    let closed = true;
    while (i < text.length && !isSeparator(text[i])) {
      if (text[i] === '"') {
        const run = readQuoted(text, i);
        closed = run.closed;
        i = run.end;
      } else {
        i++;
      }
    }
    const raw = text.slice(start, i);
    segments.push({ type: 'word', raw, ...splitAtDelimiter(raw, delimiter), closed });
  }
  return segments;
}
