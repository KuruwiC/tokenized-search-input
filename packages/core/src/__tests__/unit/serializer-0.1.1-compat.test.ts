import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { type ParseOptions, parseQueryToDoc, serializeDocToQuery } from '../../serializer';
import {
  cases,
  changedCases,
  fields,
  type SerializedCaseOptions,
  type SerializedToken,
} from '../fixtures/serialized-0.1.1';

function parseOptions({
  allowUnknownFields,
  unknownFieldOperators,
  ...options
}: SerializedCaseOptions): ParseOptions {
  if (!allowUnknownFields) return options;
  return {
    ...options,
    unknownFields: unknownFieldOperators ? { operators: unknownFieldOperators } : {},
  };
}

function tokenSequence(doc: JSONContent): SerializedToken[] {
  return (doc.content?.[0]?.content ?? []).map((node) => {
    if (node.type === 'filterToken') {
      const { key, operator, value, immutable } = node.attrs ?? {};
      return { type: 'filterToken', key, operator, value, immutable };
    }
    if (node.type === 'freeTextToken') {
      const { value, quoted } = node.attrs ?? {};
      return { type: 'freeTextToken', value, quoted };
    }
    return { type: 'text', text: node.text ?? '' };
  });
}

function read(input: string, options: SerializedCaseOptions) {
  return parseQueryToDoc(input, fields, parseOptions(options)).doc;
}

/** Writes the document the way the editor does, with its fields. */
function write(doc: JSONContent, options: SerializedCaseOptions): string {
  return serializeDocToQuery(doc, {
    delimiter: options.delimiter,
    fields,
    unknownFields: parseOptions(options).unknownFields,
  });
}

/** Queries that 0.1.1 wrote without quotes; any whitespace character is written in quotes. */
const writtenQuoted: Record<string, string> = {
  'value with a raw tab': 'name:is:"a\tb"',
  'value with a raw newline': 'name:is:"a\nb"',
  'value with a raw carriage return': 'name:is:"a\rb"',
  'segments separated by a tab': 'status:is:"active\tname:is:x"',
};

describe('the grammar reads what 0.1.1 wrote', () => {
  it('covers at least forty queries', () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
  });

  it('covers known and unknown fields, both delimiters and the three free text modes', () => {
    const optionsOf = cases.map((c) => c.options);

    expect(new Set(optionsOf.map((o) => o.delimiter ?? ':'))).toEqual(new Set([':', '=']));
    expect(new Set(optionsOf.map((o) => o.freeTextMode ?? 'plain'))).toEqual(
      new Set(['plain', 'tokenize', 'none'])
    );
    expect(optionsOf.some((o) => o.allowUnknownFields)).toBe(true);
    expect(optionsOf.some((o) => !o.allowUnknownFields)).toBe(true);
  });

  it('covers more than a few queries that 0.1.1 wrote itself', () => {
    expect(cases.filter((c) => c.source === 'serializer').length).toBeGreaterThanOrEqual(40);
  });

  it.each(cases)('parses $name into the tokens of 0.1.1: $input', ({ input, options, tokens }) => {
    expect(tokenSequence(read(input, options))).toEqual(tokens);
  });

  it.each(cases)('writes $name as 0.1.1 did, quoting whitespace', ({
    input,
    options,
    name,
    serialized,
  }) => {
    expect(write(read(input, options), options)).toBe(writtenQuoted[name] ?? serialized);
  });

  it.each(cases)('reads what it writes for $name as the same tokens', ({
    input,
    options,
    tokens,
  }) => {
    const written = write(read(input, options), options);

    expect(tokenSequence(read(written, options))).toEqual(tokens);
  });
});

type Filter = Extract<SerializedToken, { type: 'filterToken' }>;
type FreeText = Extract<SerializedToken, { type: 'freeTextToken' }>;

const filter = (key: string, operator: string, value: string): Filter => ({
  type: 'filterToken',
  key,
  operator,
  value,
  immutable: false,
});
const freeText = (value: string, quoted: boolean): FreeText => ({
  type: 'freeTextToken',
  value,
  quoted,
});

/**
 * How the current grammar reads and writes the queries in `changedCases`. A reading that
 * is left out is the one 0.1.1 had. `rewritten` is what the written string reads as.
 */
const readings: Record<
  string,
  { tokens?: SerializedToken[]; serialized: string; rewritten?: SerializedToken[] }
> = {
  'quoted value with a backslash and an n': {
    tokens: [filter('name', 'is', 'a\\nb')],
    serialized: 'name:is:"a\\\\nb"',
  },
  'quoted value with a backslash and a t': {
    tokens: [filter('name', 'is', 'a\\tb')],
    serialized: 'name:is:"a\\\\tb"',
  },
  'quoted value with a newline': { serialized: 'name:is:"a\nb"' },
  'free text word with a backslash and an n in tokenize mode': {
    serialized: '"a\\\\nb"',
    rewritten: [freeText('a\\nb', true)],
  },
  'free text with an unclosed quote in tokenize mode': {
    serialized: '"ab\\"c d"',
    rewritten: [freeText('ab"c d', true)],
  },
  'free text with a quote inside a word in tokenize mode': {
    serialized: '"ab\\"c d\\"e"',
    rewritten: [freeText('ab"c d"e', true)],
  },
  'free text with a raw tab in tokenize mode': {
    serialized: '"a\tb"',
    rewritten: [freeText('a\tb', true)],
  },
  'operator of another field after a known key': {
    tokens: [filter('status', 'contains', 'foo')],
    serialized: 'status:contains:foo',
  },
  'operator the unknown field template lacks': {
    tokens: [filter('custom', 'gt', '5')],
    serialized: 'custom:gt:5',
  },
};

describe('the grammar reads queries that 0.1.1 read differently', () => {
  it('describes every changed case', () => {
    expect(Object.keys(readings).sort()).toEqual(changedCases.map((c) => c.name).sort());
  });

  it.each(changedCases)('reads $name as the grammar says: $reason', (c) => {
    const reading = readings[c.name];
    const doc = read(c.input, c.options);
    const tokens = reading?.tokens ?? c.tokens;

    expect(tokenSequence(doc)).toEqual(tokens);
    expect(write(doc, c.options)).toBe(reading?.serialized);
    expect(tokenSequence(read(reading?.serialized ?? '', c.options))).toEqual(
      reading?.rewritten ?? tokens
    );
  });
});
