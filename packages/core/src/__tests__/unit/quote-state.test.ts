import { describe, expect, it } from 'vitest';
import { findLastWordBoundary, isInsideQuotes } from '../../serializer/quote-state';
import { tokenizeQuery } from '../../serializer/tokenize';

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

    it('counts a non-breaking space as a word boundary, as a contenteditable types it', () => {
      expect(findLastWordBoundary('hello\u00a0world')).toBe(5);
      expect(findLastWordBoundary('a b\u00a0c')).toBe(3);
    });

    it('ignores a non-breaking space inside quotes', () => {
      expect(findLastWordBoundary('"hello\u00a0world"')).toBe(-1);
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
  });
});

describe('agreement with the query tokenizer', () => {
  it.each([
    'hello',
    '"hello',
    '"hello"',
    '"hello\\"',
    'foo \\"bar',
    '"foo \\""',
    'a"b c',
    'a"b c"',
    '"a b"c"d',
    '"x\\',
    '"',
    'k:is:"a b',
    'k:is:"a b" tail',
    '"a b" "c',
  ])('reads the quote left open at the end of %j as the tokenizer does', (text) => {
    const segments = tokenizeQuery(text, ':');
    const last = segments[segments.length - 1];

    expect(isInsideQuotes(text)).toBe(last !== undefined && !last.closed);
  });
});
