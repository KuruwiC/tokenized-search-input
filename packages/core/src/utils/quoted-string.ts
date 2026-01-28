/**
 * Utility functions for handling quoted strings with escape sequences.
 *
 * Follows standard conventions:
 * - Double quotes delimit strings that can contain spaces
 * - Backslash escapes the next character: \" for literal quote, \\ for literal backslash
 * - Unquoted strings terminate on whitespace
 */

interface QuoteScanOptions {
  /**
   * Called for each character during scanning.
   * @returns false to stop scanning, true/undefined to continue
   */
  onChar?: (char: string, index: number, inQuote: boolean) => boolean | undefined;
}

interface QuoteScanResult {
  inQuote: boolean;
}

/**
 * Scan a string while tracking quote state.
 *
 * Key behaviors:
 * - \ufffc (object replacement character) acts as a hard boundary, resetting state
 * - Escape sequences (\", \\) are only processed inside quotes
 *
 * @example
 * const { inQuote } = scanQuotedString('"hello');
 * console.log(inQuote); // true
 *
 * let lastBoundary = -1;
 * scanQuotedString('"hello world" test', {
 *   onChar: (char, index, inQuote) => {
 *     if (!inQuote && char === ' ') lastBoundary = index;
 *   }
 * });
 * console.log(lastBoundary); // 13
 */
export function scanQuotedString(input: string, options: QuoteScanOptions = {}): QuoteScanResult {
  const { onChar } = options;

  let inQuote = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '\ufffc') {
      if (onChar && onChar(char, i, false) === false) {
        return { inQuote };
      }
      inQuote = false;
      escaped = false;
      continue;
    }

    if (inQuote && escaped) {
      escaped = false;
      if (onChar && onChar(char, i, inQuote) === false) {
        return { inQuote };
      }
      continue;
    }
    if (inQuote && char === '\\') {
      escaped = true;
      if (onChar && onChar(char, i, inQuote) === false) {
        return { inQuote };
      }
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
      if (onChar && onChar(char, i, inQuote) === false) {
        return { inQuote };
      }
      continue;
    }

    if (onChar && onChar(char, i, inQuote) === false) {
      return { inQuote };
    }
  }

  return { inQuote };
}

type ParseState = 'unquoted' | 'quoted' | 'escape';

interface ParseResult {
  value: string;
  isOpen: boolean;
  wasQuoted: boolean;
}

/**
 * Parse a potentially quoted string, handling escape sequences.
 *
 * @example
 * parseQuotedString('hello') // { value: 'hello', isOpen: false, wasQuoted: false }
 * parseQuotedString('"hello world"') // { value: 'hello world', isOpen: false, wasQuoted: true }
 * parseQuotedString('"hello') // { value: 'hello', isOpen: true, wasQuoted: true }
 * parseQuotedString('"say \\"hi\\""') // { value: 'say "hi"', isOpen: false, wasQuoted: true }
 * parseQuotedString('"path\\\\to"') // { value: 'path\\to', isOpen: false, wasQuoted: true }
 */
export function parseQuotedString(input: string): ParseResult {
  if (!input) {
    return { value: '', isOpen: false, wasQuoted: false };
  }

  const wasQuoted = input.startsWith('"');

  if (!wasQuoted) {
    return { value: input, isOpen: false, wasQuoted: false };
  }

  let state: ParseState = 'unquoted';
  let result = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    switch (state) {
      case 'unquoted':
        if (char === '"') {
          state = 'quoted';
        } else {
          result += char;
        }
        break;

      case 'quoted':
        if (char === '\\') {
          state = 'escape';
        } else if (char === '"') {
          state = 'unquoted';
        } else {
          result += char;
        }
        break;

      case 'escape':
        switch (char) {
          case '"':
            result += '"';
            break;
          case '\\':
            result += '\\';
            break;
          case 'n':
            result += '\n';
            break;
          case 't':
            result += '\t';
            break;
          default:
            result += `\\${char}`;
        }
        state = 'quoted';
        break;
    }
  }

  const isOpen = state === 'quoted' || state === 'escape';

  return { value: result, isOpen, wasQuoted };
}

/**
 * Check if the cursor is inside an unclosed quoted string.
 *
 * Key behaviors:
 * - \ufffc (object replacement character) acts as a hard boundary, resetting quote state
 * - Backslash escapes are only processed when inside quotes
 *
 * @example
 * isInsideQuotes('hello') // false
 * isInsideQuotes('"hello') // true
 * isInsideQuotes('"hello"') // false
 * isInsideQuotes('"hello\\"') // true
 * isInsideQuotes('\ufffc\ufffc"hello') // true
 * isInsideQuotes('"hello"\ufffc') // false
 */
export function isInsideQuotes(input: string): boolean {
  if (!input) return false;
  const { inQuote } = scanQuotedString(input);
  return inQuote;
}

/**
 * Find the last word boundary in text, respecting quote state.
 *
 * Word boundaries:
 * - Space (' ') when outside quotes
 * - Object replacement character ('\ufffc') - always a boundary
 *
 * @returns Index of last boundary, or -1 if none found
 *
 * @example
 * findLastWordBoundary('hello world') // 5
 * findLastWordBoundary('"hello world"') // -1
 * findLastWordBoundary('"aaa \\" status:hoge"') // -1
 */
export function findLastWordBoundary(text: string): number {
  let lastBoundaryIdx = -1;

  scanQuotedString(text, {
    onChar: (char, index, inQuote): undefined => {
      if (char === '\ufffc') {
        lastBoundaryIdx = index;
        return;
      }
      // Match regular space (0x20) and non-breaking space (0xA0)
      if (!inQuote && (char === ' ' || char === '\u00A0')) {
        lastBoundaryIdx = index;
      }
    },
  });

  return lastBoundaryIdx;
}

/**
 * Quote a string value if it contains spaces or special characters.
 * Escapes internal quotes and backslashes.
 *
 * @example
 * quoteIfNeeded('hello') // 'hello'
 * quoteIfNeeded('hello world') // '"hello world"'
 * quoteIfNeeded('say "hi"') // '"say \\"hi\\""'
 */
export function quoteIfNeeded(value: string): string {
  if (!value.includes(' ') && !value.includes('"') && !value.includes('\\')) {
    return value;
  }

  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Escape a string value for use inside quotes.
 * Escapes quotes and backslashes.
 *
 * @example
 * escapeForQuotes('hello') // 'hello'
 * escapeForQuotes('say "hi"') // 'say \\"hi\\"'
 * escapeForQuotes('path\\to') // 'path\\\\to'
 */
export function escapeForQuotes(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
