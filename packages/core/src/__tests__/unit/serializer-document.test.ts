import { describe, expect, it } from 'vitest';
import { parseQueryToDoc, parseTokenText, serializeDocToQuery } from '../../serializer';
import type { FieldDefinition } from '../../types';
import { fieldsWithDotNotation } from '../fixtures';

const testFields = fieldsWithDotNotation;

describe('serializer document', () => {
  describe('parseQueryToDoc', () => {
    it('parses empty query', () => {
      const doc = parseQueryToDoc('', testFields).doc;
      expect(doc.type).toBe('doc');
      expect(doc.content?.[0]?.type).toBe('paragraph');
      expect(doc.content?.[0]?.content).toBeUndefined();
    });

    it('parses simple filter query', () => {
      const doc = parseQueryToDoc('status:is:active', testFields).doc;
      const content = doc.content?.[0]?.content;
      expect(content).toHaveLength(1);
      expect(content?.[0]).toMatchObject({
        type: 'filterToken',
        attrs: {
          key: 'status',
          operator: 'is',
          value: 'active',
        },
      });
    });

    it('puts adjacent tokens next to each other with nothing between them', () => {
      const doc = parseQueryToDoc('status:is:active status:is:inactive', testFields).doc;
      const content = doc.content?.[0]?.content;
      expect(content?.map((node) => node.type)).toEqual(['filterToken', 'filterToken']);
    });

    it('parses filter with shorthand format', () => {
      const doc = parseQueryToDoc('status:active', testFields).doc;
      const content = doc.content?.[0]?.content;
      expect(content?.[0]).toMatchObject({
        type: 'filterToken',
        attrs: {
          key: 'status',
          operator: 'is',
          value: 'active',
        },
      });
    });

    it('parses filter with dot notation key', () => {
      const doc = parseQueryToDoc('user.email:contains:test', testFields).doc;
      const content = doc.content?.[0]?.content;
      expect(content?.[0]).toMatchObject({
        type: 'filterToken',
        attrs: {
          key: 'user.email',
          operator: 'contains',
          value: 'test',
        },
      });
    });

    it('parses free text', () => {
      const doc = parseQueryToDoc('hello world', testFields).doc;
      const content = doc.content?.[0]?.content;
      // Free text in plain mode: [text][space][text]
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
      const doc = parseQueryToDoc('status:is:active search term', testFields).doc;
      const content = doc.content?.[0]?.content;
      // Structure: [filterToken][text][space][text]
      expect(content?.[0]?.type).toBe('filterToken');
      expect(content?.[1]?.type).toBe('text');
      expect(content?.[1]?.text).toBe('search');
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

    it('returns null for unknown fields when unknownFields is not provided', () => {
      expect(parseTokenText('unknown:value', testFields)).toBeNull();
    });

    it('returns null for text without delimiter', () => {
      expect(parseTokenText('freetext', testFields)).toBeNull();
    });

    it('parses unknown fields with the default operators when unknownFields is empty', () => {
      const options = { unknownFields: {} };

      expect(parseTokenText('custom:value', testFields, options)).toEqual({
        key: 'custom',
        operator: 'is',
        value: 'value',
      });
      expect(parseTokenText('custom:gt:5', testFields, options)).toEqual({
        key: 'custom',
        operator: 'gt',
        value: '5',
      });
    });

    it('uses unknownFields.operators[0] for the shorthand format', () => {
      const options = { unknownFields: { operators: ['contains', 'is'] as const } };

      expect(parseTokenText('custom:value', testFields, options)).toEqual({
        key: 'custom',
        operator: 'contains',
        value: 'value',
      });
      expect(parseTokenText('custom:is:value', testFields, options)).toEqual({
        key: 'custom',
        operator: 'is',
        value: 'value',
      });
    });

    it('keeps an operator the editor knows when it is not allowed for unknown fields', () => {
      const options = { unknownFields: { operators: ['contains'] as const } };

      expect(parseTokenText('custom:gt:5', testFields, options)).toEqual({
        key: 'custom',
        operator: 'gt',
        value: '5',
      });
    });

    it('keeps the delimiter inside the value when the word after the key is no known operator', () => {
      const options = { unknownFields: { operators: ['contains'] as const } };

      expect(parseTokenText('custom:10:30', testFields, options)).toEqual({
        key: 'custom',
        operator: 'contains',
        value: '10:30',
      });
    });
  });
});
