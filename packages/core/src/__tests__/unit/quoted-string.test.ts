import { describe, expect, it } from 'vitest';
import { quote, unquote } from '../../utils/quoted-string';

describe('unquote', () => {
  describe('unquoted strings', () => {
    it('returns value as-is for simple strings', () => {
      const result = unquote('hello');
      expect(result).toEqual({ value: 'hello', closed: true, wasQuoted: false });
    });

    it('handles empty string', () => {
      const result = unquote('');
      expect(result).toEqual({ value: '', closed: true, wasQuoted: false });
    });
  });

  describe('quoted strings', () => {
    it('removes surrounding quotes from closed string', () => {
      const result = unquote('"hello world"');
      expect(result).toEqual({ value: 'hello world', closed: true, wasQuoted: true });
    });

    it('detects unclosed quoted string', () => {
      const result = unquote('"hello');
      expect(result).toEqual({ value: 'hello', closed: false, wasQuoted: true });
    });

    it('handles empty quoted string', () => {
      const result = unquote('""');
      expect(result).toEqual({ value: '', closed: true, wasQuoted: true });
    });
  });

  describe('escape sequences', () => {
    it.each([
      [
        'escaped double quotes',
        '"say \\"hi\\""',
        { value: 'say "hi"', closed: true, wasQuoted: true },
      ],
      ['escaped backslashes', '"path\\\\to"', { value: 'path\\to', closed: true, wasQuoted: true }],
      [
        'a backslash and an n as two characters',
        '"line1\\nline2"',
        { value: 'line1\\nline2', closed: true, wasQuoted: true },
      ],
      [
        'a backslash and a t as two characters',
        '"col1\\tcol2"',
        { value: 'col1\\tcol2', closed: true, wasQuoted: true },
      ],
      [
        'a raw newline and a raw tab as themselves',
        '"line1\nline2\tcol"',
        { value: 'line1\nline2\tcol', closed: true, wasQuoted: true },
      ],
      [
        'unknown escape sequences',
        '"hello\\x"',
        { value: 'hello\\x', closed: true, wasQuoted: true },
      ],
      [
        'trailing escape in unclosed string',
        '"hello\\',
        { value: 'hello', closed: false, wasQuoted: true },
      ],
      [
        'escaped quote does not close string',
        '"hello\\"',
        { value: 'hello"', closed: false, wasQuoted: true },
      ],
      [
        'complex escape sequence',
        '"a\\\\b\\"c\\nd"',
        { value: 'a\\b"c\\nd', closed: true, wasQuoted: true },
      ],
      ['text after the closing quote', '"a b"c', { value: 'a bc', closed: true, wasQuoted: true }],
      ['a second quoted run left open', '"a"b"c', { value: 'abc', closed: false, wasQuoted: true }],
    ])('handles %s', (_name, input, expected) => {
      expect(unquote(input)).toEqual(expected);
    });
  });
});

describe('quote', () => {
  it('returns simple strings unchanged', () => {
    expect(quote('hello')).toBe('hello');
  });

  it('quotes strings with spaces', () => {
    expect(quote('hello world')).toBe('"hello world"');
  });

  it('escapes internal quotes', () => {
    expect(quote('say "hi"')).toBe('"say \\"hi\\""');
  });

  it('quotes and escapes backslashes', () => {
    expect(quote('path\\to')).toBe('"path\\\\to"');
  });

  it('escapes backslashes before quotes', () => {
    expect(quote('say \\"hi\\"')).toBe('"say \\\\\\"hi\\\\\\""');
  });

  it.each([
    ['a newline', 'a\nb'],
    ['a tab', 'a\tb'],
    ['a carriage return', 'a\rb'],
  ])('quotes strings with %s and keeps the character', (_label, value) => {
    expect(quote(value)).toBe(`"${value}"`);
  });

  it('keeps a non-breaking space unquoted', () => {
    expect(quote('a\u00a0b')).toBe('a\u00a0b');
  });

  it('quotes on request', () => {
    expect(quote('hello', { always: true })).toBe('"hello"');
  });
});
