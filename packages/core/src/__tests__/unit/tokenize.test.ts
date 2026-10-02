import { describe, expect, it } from 'vitest';
import { readQuoted, tokenizeQuery } from '../../serializer/tokenize';

describe('readQuoted', () => {
  it.each([
    ['"abc" rest', 0, { value: 'abc', end: 5, closed: true }],
    ['x "a b" y', 2, { value: 'a b', end: 7, closed: true }],
    ['"a\\"b"', 0, { value: 'a"b', end: 6, closed: true }],
    ['"a\\\\"', 0, { value: 'a\\', end: 5, closed: true }],
    ['"a\\nb"', 0, { value: 'a\\nb', end: 6, closed: true }],
    ['"a\nb\tc"', 0, { value: 'a\nb\tc', end: 7, closed: true }],
    ['"open', 0, { value: 'open', end: 5, closed: false }],
    ['"open\\', 0, { value: 'open', end: 6, closed: false }],
  ])('reads %j from %i', (text, start, expected) => {
    expect(readQuoted(text, start)).toEqual(expected);
  });
});

describe('tokenizeQuery', () => {
  it('returns nothing for an empty or blank query', () => {
    expect(tokenizeQuery('', ':')).toEqual([]);
    expect(tokenizeQuery(' \t\n\r ', ':')).toEqual([]);
  });

  it('separates segments at any whitespace outside quotes', () => {
    const segments = tokenizeQuery('a\tb\nc\r\nd  e', ':');

    expect(segments.map((segment) => segment.raw)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('splits a word at its first delimiter', () => {
    expect(tokenizeQuery('status:is:active plain', ':')).toEqual([
      { type: 'word', raw: 'status:is:active', key: 'status', rest: 'is:active', closed: true },
      { type: 'word', raw: 'plain', key: null, rest: 'plain', closed: true },
    ]);
  });

  it('uses the delimiter it is given', () => {
    expect(tokenizeQuery('status=is=active a:b', '=')).toEqual([
      { type: 'word', raw: 'status=is=active', key: 'status', rest: 'is=active', closed: true },
      { type: 'word', raw: 'a:b', key: null, rest: 'a:b', closed: true },
    ]);
  });

  it('keeps whitespace inside a quoted run of a word', () => {
    expect(tokenizeQuery('name:is:"john smith" next', ':')).toEqual([
      {
        type: 'word',
        raw: 'name:is:"john smith"',
        key: 'name',
        rest: 'is:"john smith"',
        closed: true,
      },
      { type: 'word', raw: 'next', key: null, rest: 'next', closed: true },
    ]);
  });

  it('keeps a newline and a tab inside quotes', () => {
    const [segment] = tokenizeQuery('k:is:"a\nb\tc"', ':');

    expect(segment).toMatchObject({ type: 'word', raw: 'k:is:"a\nb\tc"', closed: true });
  });

  it('does not end a quoted run at an escaped quote', () => {
    const [segment] = tokenizeQuery('k:is:"a \\" b" x', ':');

    expect(segment).toMatchObject({ raw: 'k:is:"a \\" b"' });
  });

  it('reads a segment that starts with a quote as free text that ends at its closing quote', () => {
    expect(tokenizeQuery('"a b"c d', ':')).toEqual([
      { type: 'quoted', raw: '"a b"', value: 'a b', closed: true },
      { type: 'word', raw: 'c', key: null, rest: 'c', closed: true },
      { type: 'word', raw: 'd', key: null, rest: 'd', closed: true },
    ]);
  });

  it('resolves the escapes of quoted free text', () => {
    const [segment] = tokenizeQuery('"say \\"hi\\" C:\\\\temp \\n"', ':');

    expect(segment).toMatchObject({ type: 'quoted', value: 'say "hi" C:\\temp \\n', closed: true });
  });

  it('runs a quote that is left open to the end of the text', () => {
    expect(tokenizeQuery('"a b  c', ':')).toEqual([
      { type: 'quoted', raw: '"a b  c', value: 'a b  c', closed: false },
    ]);
    expect(tokenizeQuery('k:is:"a b', ':')).toEqual([
      { type: 'word', raw: 'k:is:"a b', key: 'k', rest: 'is:"a b', closed: false },
    ]);
  });

  it('treats a non-breaking space as part of a word', () => {
    expect(tokenizeQuery('a\u00a0b', ':')).toHaveLength(1);
  });
});
