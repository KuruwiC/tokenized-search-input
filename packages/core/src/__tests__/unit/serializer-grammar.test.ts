import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { parseQueryToDoc, serializeDocToQuery } from '../../serializer';
import type { FieldDefinition } from '../../types';

const fields: FieldDefinition[] = [
  { key: 'k', label: 'K', type: 'string', operators: ['is', 'contains'] },
];

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
    const [node] = tokenNodes(parseQueryToDoc(serialized, fields));
    expect(node?.attrs?.value).toBe(value);
  });

  it('quotes free text with whitespace even when the token is not marked quoted', () => {
    const serialized = serializeDocToQuery(docOf(freeTextNode('hello world')));

    expect(serialized).toBe('"hello world"');
    const reparsed = tokenNodes(parseQueryToDoc(serialized, fields, { freeTextMode: 'tokenize' }));
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
