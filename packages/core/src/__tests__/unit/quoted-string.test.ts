import { describe, expect, it } from 'vitest';
import {
  findLastWordBoundary,
  isInsideQuotes,
  parseQuotedString,
  quoteIfNeeded,
  scanQuotedString,
} from '../../utils/quoted-string';

describe('parseQuotedString', () => {
  describe('unquoted strings', () => {
    it('returns value as-is for simple strings', () => {
      const result = parseQuotedString('hello');
      expect(result).toEqual({ value: 'hello', isOpen: false, wasQuoted: false });
    });

    it('handles empty string', () => {
      const result = parseQuotedString('');
      expect(result).toEqual({ value: '', isOpen: false, wasQuoted: false });
    });
  });

  describe('quoted strings', () => {
    it('removes surrounding quotes from closed string', () => {
      const result = parseQuotedString('"hello world"');
      expect(result).toEqual({ value: 'hello world', isOpen: false, wasQuoted: true });
    });

    it('detects unclosed quoted string', () => {
      const result = parseQuotedString('"hello');
      expect(result).toEqual({ value: 'hello', isOpen: true, wasQuoted: true });
    });

    it('handles empty quoted string', () => {
      const result = parseQuotedString('""');
      expect(result).toEqual({ value: '', isOpen: false, wasQuoted: true });
    });
  });

  describe('escape sequences', () => {
    it.each([
      [
        'escaped double quotes',
        '"say \\"hi\\""',
        { value: 'say "hi"', isOpen: false, wasQuoted: true },
      ],
      [
        'escaped backslashes',
        '"path\\\\to"',
        { value: 'path\\to', isOpen: false, wasQuoted: true },
      ],
      [
        'newline characters',
        '"line1\\nline2"',
        { value: 'line1\nline2', isOpen: false, wasQuoted: true },
      ],
      ['tab characters', '"col1\\tcol2"', { value: 'col1\tcol2', isOpen: false, wasQuoted: true }],
      [
        'unknown escape sequences',
        '"hello\\x"',
        { value: 'hello\\x', isOpen: false, wasQuoted: true },
      ],
      [
        'trailing escape in unclosed string',
        '"hello\\',
        { value: 'hello', isOpen: true, wasQuoted: true },
      ],
      [
        'escaped quote does not close string',
        '"hello\\"',
        { value: 'hello"', isOpen: true, wasQuoted: true },
      ],
      [
        'complex escape sequence',
        '"a\\\\b\\"c\\nd"',
        { value: 'a\\b"c\nd', isOpen: false, wasQuoted: true },
      ],
    ])('handles %s', (_name, input, expected) => {
      expect(parseQuotedString(input)).toEqual(expected);
    });
  });
});

describe('isInsideQuotes', () => {
  it('returns false for unquoted strings', () => {
    expect(isInsideQuotes('hello')).toBe(false);
  });

  it('returns true for unclosed quoted string', () => {
    expect(isInsideQuotes('"hello')).toBe(true);
  });

  it('returns false for closed quoted string', () => {
    expect(isInsideQuotes('"hello"')).toBe(false);
  });

  it('returns true when escaped quote does not close', () => {
    expect(isInsideQuotes('"hello\\"')).toBe(true);
  });

  it('returns false when escaped quote followed by closing quote', () => {
    expect(isInsideQuotes('"hello\\""')).toBe(false);
  });

  describe('with \\ufffc boundary characters', () => {
    it('returns true for quote after \\ufffc characters', () => {
      expect(isInsideQuotes('\ufffc\ufffc\ufffc"hello')).toBe(true);
    });

    it('returns false for closed quote after \\ufffc characters', () => {
      expect(isInsideQuotes('\ufffc\ufffc\ufffc"hello"')).toBe(false);
    });

    it('resets quote state at \\ufffc boundary', () => {
      // Quote before boundary should be forgotten
      expect(isInsideQuotes('"hello\ufffcworld')).toBe(false);
    });

    it('resets quote state at \\ufffc even for closed quotes', () => {
      // Closed quote before boundary, no quote after
      expect(isInsideQuotes('"hello"\ufffc')).toBe(false);
    });

    it('handles quote opened after boundary', () => {
      // Boundary resets, then new quote opens
      expect(isInsideQuotes('"hello"\ufffc"world')).toBe(true);
    });

    it('handles multiple boundaries with quotes between', () => {
      // Each boundary resets the state
      expect(isInsideQuotes('"a"\ufffc"b"\ufffc"c')).toBe(true);
      expect(isInsideQuotes('"a"\ufffc"b"\ufffc"c"')).toBe(false);
    });
  });

  describe('escape handling outside quotes', () => {
    it('ignores backslash before quote when not inside quotes', () => {
      // Backslash outside quotes should not prevent quote from opening
      expect(isInsideQuotes('foo \\"bar')).toBe(true);
    });

    it('treats escaped quote inside quotes correctly', () => {
      expect(isInsideQuotes('"foo \\"bar')).toBe(true);
    });

    it('correctly handles quote after escaped quote inside quotes', () => {
      expect(isInsideQuotes('"foo \\""')).toBe(false);
    });
  });

  describe('empty and edge cases', () => {
    it('returns false for empty string', () => {
      expect(isInsideQuotes('')).toBe(false);
    });

    it('returns false for only \\ufffc characters', () => {
      expect(isInsideQuotes('\ufffc\ufffc\ufffc')).toBe(false);
    });

    it('returns true for just opening quote', () => {
      expect(isInsideQuotes('"')).toBe(true);
    });

    it('returns false for just empty quotes', () => {
      expect(isInsideQuotes('""')).toBe(false);
    });
  });
});

describe('quoteIfNeeded', () => {
  it('returns simple string as-is', () => {
    expect(quoteIfNeeded('hello')).toBe('hello');
  });

  it('quotes strings with spaces', () => {
    expect(quoteIfNeeded('hello world')).toBe('"hello world"');
  });

  it('escapes internal quotes', () => {
    expect(quoteIfNeeded('say "hi"')).toBe('"say \\"hi\\""');
  });

  it('escapes internal backslashes', () => {
    expect(quoteIfNeeded('path\\to')).toBe('"path\\\\to"');
  });

  it('escapes both quotes and backslashes', () => {
    expect(quoteIfNeeded('say \\"hi\\"')).toBe('"say \\\\\\"hi\\\\\\""');
  });
});

describe('scanQuotedString', () => {
  describe('basic quote tracking', () => {
    it('returns inQuote=false for unquoted text', () => {
      expect(scanQuotedString('hello').inQuote).toBe(false);
    });

    it('returns inQuote=true for unclosed quote', () => {
      expect(scanQuotedString('"hello').inQuote).toBe(true);
    });

    it('returns inQuote=false for closed quote', () => {
      expect(scanQuotedString('"hello"').inQuote).toBe(false);
    });

    it('returns inQuote=false for empty string', () => {
      expect(scanQuotedString('').inQuote).toBe(false);
    });
  });

  describe('escape handling', () => {
    it('escaped quote does not close string', () => {
      expect(scanQuotedString('"hello\\"').inQuote).toBe(true);
    });

    it('escaped quote followed by closing quote', () => {
      expect(scanQuotedString('"hello\\""').inQuote).toBe(false);
    });

    it('escaped backslash followed by quote closes string', () => {
      expect(scanQuotedString('"hello\\\\"').inQuote).toBe(false);
    });
  });

  describe('\\ufffc boundary', () => {
    it('resets quote state', () => {
      expect(scanQuotedString('"hello\ufffcworld').inQuote).toBe(false);
    });

    it('new quote after boundary', () => {
      expect(scanQuotedString('"hello"\ufffc"world').inQuote).toBe(true);
    });

    it('returns inQuote=false for only \\ufffc characters', () => {
      expect(scanQuotedString('\ufffc\ufffc\ufffc').inQuote).toBe(false);
    });
  });

  describe('onChar callback', () => {
    it('receives correct inQuote state for each character', () => {
      const states: boolean[] = [];
      scanQuotedString('"ab"c', {
        onChar: (_char, _index, inQuote): undefined => {
          states.push(inQuote);
        },
      });
      // " -> true, a -> true, b -> true, " -> false, c -> false
      expect(states).toEqual([true, true, true, false, false]);
    });

    it('receives correct indices', () => {
      const indices: number[] = [];
      scanQuotedString('abc', {
        onChar: (_char, index): undefined => {
          indices.push(index);
        },
      });
      expect(indices).toEqual([0, 1, 2]);
    });

    it('can stop scanning early by returning false', () => {
      let count = 0;
      scanQuotedString('abcdef', {
        onChar: () => {
          count++;
          return count < 3 ? undefined : false;
        },
      });
      expect(count).toBe(3);
    });

    it('reports \\ufffc as outside quotes', () => {
      const results: Array<{ char: string; inQuote: boolean }> = [];
      scanQuotedString('"a\ufffcb', {
        onChar: (char, _index, inQuote): undefined => {
          results.push({ char, inQuote });
        },
      });
      expect(results).toEqual([
        { char: '"', inQuote: true },
        { char: 'a', inQuote: true },
        { char: '\ufffc', inQuote: false },
        { char: 'b', inQuote: false },
      ]);
    });
  });
});

describe('findLastWordBoundary', () => {
  describe('basic boundary detection', () => {
    it('finds space in unquoted text', () => {
      expect(findLastWordBoundary('hello world')).toBe(5);
    });

    it('finds last space among multiple', () => {
      expect(findLastWordBoundary('a b c d')).toBe(5);
    });

    it('returns -1 for empty string', () => {
      expect(findLastWordBoundary('')).toBe(-1);
    });

    it('returns -1 for no boundaries', () => {
      expect(findLastWordBoundary('hello')).toBe(-1);
    });
  });

  describe('quote-aware boundary detection', () => {
    it('ignores space inside quotes', () => {
      expect(findLastWordBoundary('"hello world"')).toBe(-1);
    });

    it('finds space after quoted section', () => {
      expect(findLastWordBoundary('"hello world" test')).toBe(13);
    });

    it('finds space before quoted section', () => {
      expect(findLastWordBoundary('foo "bar baz"')).toBe(3);
    });

    it('ignores space in escaped quote context', () => {
      expect(findLastWordBoundary('"aaa \\" status:hoge"')).toBe(-1);
    });

    it('finds space after escaped quote string', () => {
      expect(findLastWordBoundary('"aaa \\" status:hoge" ')).toBe(20);
    });
  });

  describe('\\ufffc boundary handling', () => {
    it('always treats \\ufffc as boundary', () => {
      expect(findLastWordBoundary('\ufffc"hello"')).toBe(0);
    });

    it('treats \\ufffc as boundary even inside quotes', () => {
      // Note: \ufffc resets quote state, so it's reported as outside quotes
      expect(findLastWordBoundary('"hello\ufffc"')).toBe(6);
    });

    it('finds space after \\ufffc resets quote state', () => {
      // Quote opens, then \ufffc resets state, then space is found
      expect(findLastWordBoundary('"open\ufffc test')).toBe(6);
    });

    it('finds last \\ufffc among multiple boundaries', () => {
      expect(findLastWordBoundary('\ufffc\ufffc\ufffc')).toBe(2);
    });
  });

  describe('complex scenarios', () => {
    it('handles multiple quoted sections', () => {
      expect(findLastWordBoundary('"a b" "c d"')).toBe(5);
    });

    it('handles escaped quotes correctly', () => {
      expect(findLastWordBoundary('"say \\"hello world\\""')).toBe(-1);
    });

    it('handles filter-like patterns inside quotes', () => {
      // This is the original bug case
      expect(findLastWordBoundary('"aaa \\" status:hoge"')).toBe(-1);
    });
  });
});
