import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { type ParseQueryOptions, parseQueryToDoc, serializeDocToQuery } from '../../serializer';
import {
  cases,
  fields,
  type SerializedCaseOptions,
  type SerializedToken,
} from '../fixtures/serialized-0.1.1';

function parseOptions({
  unknownFieldOperators,
  ...options
}: SerializedCaseOptions): ParseQueryOptions {
  return unknownFieldOperators
    ? { ...options, unknownFields: { operators: unknownFieldOperators } }
    : options;
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

describe('serializer output compared with 0.1.1', () => {
  it('covers at least twenty queries', () => {
    expect(cases.length).toBeGreaterThanOrEqual(20);
  });

  it.each(cases)('$name: $input', ({ input, options, tokens, serialized }) => {
    const doc = parseQueryToDoc(input, fields, parseOptions(options));

    expect(tokenSequence(doc)).toEqual(tokens);
    expect(serializeDocToQuery(doc, { delimiter: options.delimiter })).toBe(serialized);
  });
});
