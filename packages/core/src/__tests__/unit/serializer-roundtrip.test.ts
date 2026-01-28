import { describe, expect, it } from 'vitest';
import { parseQueryToDoc, serializeDocToQuery } from '../../serializer';
import type { FieldDefinition, FreeTextMode } from '../../types';

/**
 * Round-trip tests for serializer.
 * These tests verify that parseQueryToDoc → serializeDocToQuery produces consistent results.
 */
describe('Serializer Round-trip', () => {
  const fields: FieldDefinition[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      operators: ['is', 'is_not'],
      enumValues: ['open', 'closed'],
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'enum',
      operators: ['is', 'gt', 'lt'],
      enumValues: ['high', 'medium', 'low'],
    },
    { key: 'assignee', label: 'Assignee', type: 'string', operators: ['is', 'is_not'] },
    { key: 'created', label: 'Created', type: 'date', operators: ['gt', 'lt'] },
  ];

  describe('filter tokens', () => {
    const filterQueries = [
      'status:is:open',
      'priority:gt:high',
      'assignee:is:john',
      'created:gt:2024-01-01',
    ];

    it.each(filterQueries)('round-trips filter query: %s', (query) => {
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });

    it('round-trips multiple filter tokens', () => {
      const query = 'status:is:open priority:gt:high';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });

    it('round-trips filter with default operator', () => {
      // When operator is omitted, parser uses default operator
      const input = 'status:open';
      const doc = parseQueryToDoc(input, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      // Output includes the default operator
      expect(result).toBe('status:is:open');
    });
  });

  describe('free text tokens (tokenize mode)', () => {
    it('round-trips simple free text', () => {
      const query = 'searchterm';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });

    it('round-trips quoted free text', () => {
      const query = '"hello world"';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });

    it('round-trips quoted text with escaped quotes', () => {
      const query = '"say \\"hello\\""';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });

    it('round-trips multiple free text tokens', () => {
      const query = 'hello world';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });
  });

  describe('mixed filter and free text', () => {
    it('round-trips filter followed by free text', () => {
      const query = 'status:is:open search';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });

    it('round-trips free text followed by filter', () => {
      const query = 'search status:is:open';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });

    it('round-trips complex mixed query', () => {
      const query = 'status:is:open "hello world" priority:gt:high search';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });
  });

  describe('filter values with special characters', () => {
    it('round-trips filter value with spaces (quoted)', () => {
      const query = 'assignee:is:"John Doe"';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });

    it('round-trips filter value with comma (quotes stripped if not needed)', () => {
      const query = 'status:is:"a,b,c"';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      // Commas don't require quotes for parsing, so serializer strips them
      expect(result).toBe('status:is:a,b,c');
    });

    it('round-trips filter value with colon (quotes stripped if not needed)', () => {
      const query = 'created:lt:"2024-01-01:00:00"';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      // Colons in value position don't require quotes, so serializer strips them
      expect(result).toBe('created:lt:2024-01-01:00:00');
    });
  });

  describe('freeTextMode variations', () => {
    const modes: FreeTextMode[] = ['tokenize', 'plain', 'none'];

    it.each(modes)('filter tokens work consistently in %s mode', (mode) => {
      const query = 'status:is:open priority:gt:high';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: mode });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });

    it('plain mode preserves free text as plain text', () => {
      const query = 'status:is:open search';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'plain' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe(query);
    });

    it('none mode removes free text', () => {
      const query = 'status:is:open search';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'none' });
      const result = serializeDocToQuery(doc);
      // Free text is removed in none mode
      expect(result).toBe('status:is:open');
    });
  });

  describe('edge cases', () => {
    it('handles empty query', () => {
      const query = '';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe('');
    });

    it('normalizes multiple spaces', () => {
      const query = 'status:is:open   search';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      // Multiple spaces are normalized to single space
      expect(result).toBe('status:is:open search');
    });

    it('handles whitespace-only query', () => {
      const query = '   ';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      expect(result).toBe('');
    });

    it('handles unknown field as free text', () => {
      const query = 'unknown:value';
      const doc = parseQueryToDoc(query, fields, { freeTextMode: 'tokenize' });
      const result = serializeDocToQuery(doc);
      // Unknown field is treated as free text, not a filter
      expect(result).toBe('unknown:value');
    });
  });
});
