import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { parseQueryString, parseQueryToDoc, serializeDocToQuery } from '../../serializer';
import type { FieldDefinition } from '../../types';

const fields: FieldDefinition[] = [
  { key: 'k', label: 'K', type: 'string', operators: ['is', 'contains'] },
];

const statusFields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is', 'is_not'] },
  { key: 'when', label: 'When', type: 'string', operators: ['is', 'gt'] },
];

function parseDoc(...args: Parameters<typeof parseQueryToDoc>): JSONContent {
  return parseQueryToDoc(...args).doc;
}

function docOf(...content: JSONContent[]): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph', content }] };
}

function filterNode(value: string): JSONContent {
  return { type: 'filterToken', attrs: { key: 'k', operator: 'is', value } };
}

function freeTextNode(value: string, quoted = false): JSONContent {
  return { type: 'freeTextToken', attrs: { value, quoted } };
}

function tokenNodes(doc: JSONContent): JSONContent[] {
  return doc.content?.[0]?.content ?? [];
}

describe('quoting on serialize', () => {
  it.each([
    ['a newline', 'a\nb'],
    ['a tab', 'a\tb'],
    ['a carriage return', 'a\rb'],
  ])('quotes a filter value with %s and reads it back as one value', (_label, value) => {
    const serialized = serializeDocToQuery(docOf(filterNode(value)));

    expect(serialized).toBe(`k:is:"${value}"`);
    const [node] = tokenNodes(parseDoc(serialized, fields));
    expect(node?.attrs?.value).toBe(value);
  });

  it('quotes free text with whitespace even when the token is not marked quoted', () => {
    const serialized = serializeDocToQuery(docOf(freeTextNode('hello world')));

    expect(serialized).toBe('"hello world"');
    const reparsed = tokenNodes(parseDoc(serialized, fields, { freeTextMode: 'tokenize' }));
    expect(reparsed).toHaveLength(1);
    expect(reparsed[0]?.attrs?.value).toBe('hello world');
  });

  it('quotes free text that would read as a key and value', () => {
    expect(serializeDocToQuery(docOf(freeTextNode('k:value')))).toBe('"k:value"');
  });

  it('leaves free text that needs no quotes as written', () => {
    expect(serializeDocToQuery(docOf(freeTextNode('plain')))).toBe('plain');
  });
});

describe('escapes inside quotes', () => {
  const written = 'k:is:"a\\nb"';

  it('keeps a backslash and an n as the two characters they are', () => {
    const [node] = tokenNodes(parseDoc(written, fields));

    expect(node?.attrs?.value).toBe('a\\nb');
    expect(String(node?.attrs?.value)).toHaveLength(4);
  });

  it('keeps a backslash and a t as the two characters they are', () => {
    const [node] = tokenNodes(parseDoc('k:is:"a\\tb"', fields));

    expect(node?.attrs?.value).toBe('a\\tb');
  });

  it('writes the value back with its backslash escaped and reads it again as the same value', () => {
    const doc = parseDoc(written, fields);
    const serialized = serializeDocToQuery(doc);

    expect(serialized).toBe('k:is:"a\\\\nb"');
    expect(tokenNodes(parseDoc(serialized, fields))[0]?.attrs?.value).toBe('a\\nb');
  });

  it('reads a quoted value with a newline as it is and writes it back quoted', () => {
    const query = 'k:is:"a\nb"';
    const doc = parseDoc(query, fields);

    expect(tokenNodes(doc)[0]?.attrs?.value).toBe('a\nb');
    expect(serializeDocToQuery(doc)).toBe(query);
  });
});

describe('diagnostics', () => {
  it('lists an operator the field does not allow and keeps it on the token', () => {
    const { tokens, diagnostics } = parseQueryString('status:contains:foo', statusFields);

    expect(tokens).toEqual([{ type: 'filter', key: 'status', operator: 'contains', value: 'foo' }]);
    expect(diagnostics.unknownOperators).toEqual([{ key: 'status', operator: 'contains' }]);
  });

  it('keeps the operator on the token of the document', () => {
    const { doc, diagnostics } = parseQueryToDoc('status:contains:foo', statusFields);

    expect(tokenNodes(doc)[0]?.attrs).toMatchObject({
      key: 'status',
      operator: 'contains',
      value: 'foo',
    });
    expect(diagnostics.unknownOperators).toEqual([{ key: 'status', operator: 'contains' }]);
    expect(serializeDocToQuery(doc)).toBe('status:contains:foo');
  });

  it('lists an operator the unknown field template does not allow', () => {
    const { tokens, diagnostics } = parseQueryString('custom:gt:5', statusFields, {
      unknownFields: { operators: ['is', 'contains'] },
    });

    expect(tokens).toEqual([{ type: 'filter', key: 'custom', operator: 'gt', value: '5' }]);
    expect(diagnostics.unknownOperators).toEqual([{ key: 'custom', operator: 'gt' }]);
  });

  it('reads a word after the key that no field declares as part of the value', () => {
    const { tokens, diagnostics } = parseQueryString('when:10:30 status:matches:x', statusFields);

    expect(tokens).toEqual([
      { type: 'filter', key: 'when', operator: 'is', value: '10:30' },
      { type: 'filter', key: 'status', operator: 'is', value: 'matches:x' },
    ]);
    expect(diagnostics.unknownOperators).toEqual([]);
  });

  it('does not list an operator the field allows', () => {
    const { diagnostics } = parseQueryString('status:is_not:foo when:gt:5', statusFields);

    expect(diagnostics.unknownOperators).toEqual([]);
  });

  it('lists the keys that match no field once each and leaves them as free text', () => {
    const { tokens, diagnostics } = parseQueryString(
      'a:1 status:is:x b:is:2 a:3 plain',
      statusFields
    );

    expect(diagnostics.unknownFields).toEqual(['a', 'b']);
    expect(tokens.map((token) => token.type)).toEqual([
      'freeText',
      'filter',
      'freeText',
      'freeText',
      'freeText',
    ]);
  });

  it('does not list a key the unknown field template accepts', () => {
    const { tokens, diagnostics } = parseQueryString('a:1', statusFields, { unknownFields: {} });

    expect(diagnostics.unknownFields).toEqual([]);
    expect(tokens[0]?.type).toBe('filter');
  });

  it.each([
    ['"open phrase', true],
    ['status:is:"open value', true],
    ['"closed phrase" status:is:x', false],
    ['plain', false],
  ])('reports an open quote in %j as %s', (query, expected) => {
    expect(parseQueryString(query, statusFields).diagnostics.incompleteQuote).toBe(expected);
  });
});

describe('the edges of a query', () => {
  it.each([
    ['an ideographic space', '太郎　'],
    ['a non-breaking space', 'a '],
  ])('keeps %s at the end of the last value', (_label, value) => {
    const serialized = serializeDocToQuery(docOf(filterNode(value)));

    expect(serialized).toBe(`k:is:${value}`);
    expect(tokenNodes(parseDoc(serialized, fields))[0]?.attrs?.value).toBe(value);
  });

  it('keeps an ideographic space at the start of the first free text', () => {
    expect(serializeDocToQuery(docOf(freeTextNode('　太郎')))).toBe('　太郎');
  });

  it('writes nothing for free text that is only whitespace, as the parser drops it', () => {
    expect(serializeDocToQuery(docOf(freeTextNode(' ', true)))).toBe('');
    expect(serializeDocToQuery(docOf(freeTextNode('\t')))).toBe('');
    expect(tokenNodes(parseDoc('" "', fields, { freeTextMode: 'tokenize' }))).toEqual([]);
  });
});
