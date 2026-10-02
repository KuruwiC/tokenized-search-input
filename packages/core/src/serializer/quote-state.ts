import { readQuoted } from './tokenize';

/** Object replacement character: a token node in the text before the caret. */
const TOKEN_BOUNDARY = '￼';

function isSpace(char: string): boolean {
  // Also a non-breaking space, which a contenteditable inserts for a typed space.
  return char === ' ' || char === ' ';
}

/** Reads `text` as one stretch of typed text; a token boundary is not part of it. */
function scanStretch(stretch: string): { openQuote: boolean; lastSpace: number } {
  let openQuote = false;
  let lastSpace = -1;
  let i = 0;
  while (i < stretch.length) {
    if (stretch[i] === '"') {
      const run = readQuoted(stretch, i);
      openQuote = !run.closed;
      i = run.end;
    } else {
      if (isSpace(stretch[i])) lastSpace = i;
      i++;
    }
  }
  return { openQuote, lastSpace };
}

/** Whether `text`, after its last token boundary, ends inside a quote that is still open. */
export function isInsideQuotes(text: string): boolean {
  const stretch = text.slice(text.lastIndexOf(TOKEN_BOUNDARY) + 1);
  return scanStretch(stretch).openQuote;
}

/**
 * The index of the last word boundary in `text`: a token boundary, or a space outside
 * quotes. A token boundary also closes any quote before it. Returns -1 when there is none.
 *
 * @example
 * findLastWordBoundary('hello world') // 5
 * findLastWordBoundary('"hello world"') // -1
 * findLastWordBoundary('"aaa \\" status:hoge"') // -1
 */
export function findLastWordBoundary(text: string): number {
  let last = -1;
  let offset = 0;
  const stretches = text.split(TOKEN_BOUNDARY);
  stretches.forEach((stretch, index) => {
    const { lastSpace } = scanStretch(stretch);
    if (lastSpace >= 0) last = offset + lastSpace;
    offset += stretch.length;
    if (index < stretches.length - 1) {
      last = offset;
      offset += TOKEN_BOUNDARY.length;
    }
  });
  return last;
}
