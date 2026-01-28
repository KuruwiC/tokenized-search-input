import { describe, expect, it } from 'vitest';
import { parseQueryToDoc, parseTokenText, serializeDocToQuery } from '../../serializer';
import type { FieldDefinition } from '../../types';
import { fieldsWithDotNotation } from '../fixtures';

const testFields = fieldsWithDotNotation;

describe('serializer', () => {
  describe('parseQueryToDoc', () => {
    it('parses empty query', () => {
      const doc = parseQueryToDoc('', testFields);
      expect(doc.type).toBe('doc');
      expect(doc.content?.[0]?.type).toBe('paragraph');
      expect(doc.content?.[0]?.content).toBeUndefined();
    });

    it('parses simple filter query', () => {
      const doc = parseQueryToDoc('status:is:active', testFields);
      const content = doc.content?.[0]?.content;
      // Spacer architecture: [spacer][token][spacer]
      expect(content?.[0]?.type).toBe('spacer');
      expect(content?.[1]).toMatchObject({
        type: 'filterToken',
        attrs: {
          key: 'status',
          operator: 'is',
          value: 'active',
        },
      });
      expect(content?.[2]?.type).toBe('spacer');
    });

    it('parses filter with shorthand format', () => {
      const doc = parseQueryToDoc('status:active', testFields);
      const content = doc.content?.[0]?.content;
      // Spacer architecture: [spacer][token][spacer]
      expect(content?.[1]).toMatchObject({
        type: 'filterToken',
        attrs: {
          key: 'status',
          operator: 'is',
          value: 'active',
        },
      });
    });

    it('parses filter with dot notation key', () => {
      const doc = parseQueryToDoc('user.email:contains:test', testFields);
      const content = doc.content?.[0]?.content;
      // Spacer architecture: [spacer][token][spacer]
      expect(content?.[1]).toMatchObject({
        type: 'filterToken',
        attrs: {
          key: 'user.email',
          operator: 'contains',
          value: 'test',
        },
      });
    });

    it('parses free text', () => {
      const doc = parseQueryToDoc('hello world', testFields);
      const content = doc.content?.[0]?.content;
      // Free text in plain mode: [text][space][text] (no spacers for plain text)
      expect(content?.[0]).toMatchObject({
        type: 'text',
        text: 'hello',
      });
      expect(content?.[1]).toMatchObject({
        type: 'text',
        text: ' ',
      });
      expect(content?.[2]).toMatchObject({
        type: 'text',
        text: 'world',
      });
    });

    it('parses mixed filter and free text', () => {
      const doc = parseQueryToDoc('status:is:active search term', testFields);
      const content = doc.content?.[0]?.content;
      // Structure: [spacer][filterToken][spacer][text][space][text]
      // Filter tokens get spacers on both sides, plain text does not
      expect(content?.[0]?.type).toBe('spacer');
      expect(content?.[1]?.type).toBe('filterToken');
      expect(content?.[2]?.type).toBe('spacer');
      expect(content?.[3]?.type).toBe('text');
      expect(content?.[3]?.text).toBe('search');
    });

    it('parses quoted text with escaped quotes', () => {
      const doc = parseQueryToDoc('"say \\"hello\\""', testFields, { freeTextMode: 'tokenize' });
      const content = doc.content?.[0]?.content;
      // Spacer architecture: [spacer][freeTextToken][spacer]
      expect(content?.[1]).toMatchObject({
        type: 'freeTextToken',
        attrs: {
          value: 'say "hello"',
          quoted: true,
        },
      });
    });

    it('parses quoted text with escaped backslash', () => {
      const doc = parseQueryToDoc('"path\\\\to\\\\file"', testFields, { freeTextMode: 'tokenize' });
      const content = doc.content?.[0]?.content;
      // Spacer architecture: [spacer][freeTextToken][spacer]
      expect(content?.[1]).toMatchObject({
        type: 'freeTextToken',
        attrs: {
          value: 'path\\to\\file',
          quoted: true,
        },
      });
    });
  });

  describe('serializeDocToQuery', () => {
    it('serializes empty document', () => {
      const doc = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [] }],
      };
      expect(serializeDocToQuery(doc)).toBe('');
    });

    it('serializes filterToken node', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'filterToken',
                attrs: {
                  key: 'status',
                  operator: 'is',
                  value: 'active',
                },
              },
            ],
          },
        ],
      };
      expect(serializeDocToQuery(doc)).toBe('status:is:active');
    });

    it('serializes multiple tokens', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'filterToken',
                attrs: { key: 'status', operator: 'is', value: 'active' },
              },
              { type: 'text', text: ' ' },
              {
                type: 'filterToken',
                attrs: { key: 'priority', operator: 'is', value: 'high' },
              },
            ],
          },
        ],
      };
      expect(serializeDocToQuery(doc)).toBe('status:is:active priority:is:high');
    });

    it('serializes comma-containing values', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'filterToken',
                attrs: {
                  key: 'status',
                  operator: 'is',
                  value: 'active,pending',
                },
              },
            ],
          },
        ],
      };
      expect(serializeDocToQuery(doc)).toBe('status:is:active,pending');
    });

    it('serializes freeTextToken with escaped quotes', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'freeTextToken',
                attrs: {
                  value: 'say "hello"',
                  quoted: true,
                },
              },
            ],
          },
        ],
      };
      expect(serializeDocToQuery(doc)).toBe('"say \\"hello\\""');
    });

    it('serializes freeTextToken with escaped backslash', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'freeTextToken',
                attrs: {
                  value: 'path\\to\\file',
                  quoted: true,
                },
              },
            ],
          },
        ],
      };
      expect(serializeDocToQuery(doc)).toBe('"path\\\\to\\\\file"');
    });
  });

  describe('parseTokenText (pure parser)', () => {
    const immutableFields: FieldDefinition[] = [
      {
        key: 'country',
        label: 'Country',
        type: 'enum',
        operators: ['is'],
        immutable: true,
        enumValues: ['us', 'jp'],
      },
    ];

    it('parses complete tokens regardless of immutable: true', () => {
      // immutable only affects the delimiter trigger in tryAutoTokenize
      // parseTokenText should always parse valid tokens
      expect(parseTokenText('country:is:jp', immutableFields)).toEqual({
        key: 'country',
        operator: 'is',
        value: 'jp',
      });
    });

    it('parses shorthand format regardless of immutable: true', () => {
      expect(parseTokenText('country:jp', immutableFields)).toEqual({
        key: 'country',
        operator: 'is',
        value: 'jp',
      });
    });

    it('parses tokens with default immutable (false)', () => {
      expect(parseTokenText('status:is:active', testFields)).toEqual({
        key: 'status',
        operator: 'is',
        value: 'active',
      });
    });

    it('returns null for unknown fields without allowUnknownFields', () => {
      expect(parseTokenText('unknown:value', testFields)).toBeNull();
    });

    it('returns null for text without delimiter', () => {
      expect(parseTokenText('freetext', testFields)).toBeNull();
    });
  });
});
