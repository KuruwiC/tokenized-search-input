import { describe, expect, it } from 'vitest';
import { filterItems } from '../../utils/filter-items';
import { exact, fuzzy, matchers } from '../../utils/matcher';

interface TestItem {
  id: string;
  name: string;
  description?: string;
}

describe('filterItems', () => {
  const items: TestItem[] = [
    { id: 'active', name: 'Active Status', description: 'Currently active' },
    { id: 'inactive', name: 'Inactive Status', description: 'Not active' },
    { id: 'pending', name: 'Pending Review', description: 'Awaiting approval' },
    { id: 'archived', name: 'Archived', description: 'Old items' },
  ];

  const getTargets = (item: TestItem) => [item.id, item.name];

  describe('basic filtering', () => {
    it('returns all items for empty query', () => {
      expect(filterItems(items, '', getTargets)).toEqual(items);
      expect(filterItems(items, '  ', getTargets)).toEqual(items);
    });

    it('returns empty array for empty items', () => {
      expect(filterItems([], 'test', getTargets)).toEqual([]);
    });

    it('returns empty array for undefined items', () => {
      expect(filterItems(undefined as unknown as TestItem[], 'test', getTargets)).toEqual([]);
    });

    it('filters items by fuzzy match (default)', () => {
      const result = filterItems(items, 'act', getTargets);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((item) => item.id === 'active')).toBe(true);
    });

    it('sorts results by score (highest first)', () => {
      const result = filterItems(items, 'act', getTargets);
      // 'active' should be first as it starts with 'act'
      expect(result[0].id).toBe('active');
    });
  });

  describe('matcher option', () => {
    it('uses specified matcher', () => {
      // With exact matcher, 'act' won't match 'active'
      const exactResult = filterItems(items, 'act', getTargets, { matcher: exact });
      expect(exactResult).toEqual([]);

      // Full id should match
      const exactFullResult = filterItems(items, 'active', getTargets, { matcher: exact });
      expect(exactFullResult.length).toBe(1);
      expect(exactFullResult[0].id).toBe('active');
    });

    it('uses matchers namespace', () => {
      const result = filterItems(items, 'active', getTargets, { matcher: matchers.exact });
      expect(result.length).toBe(1);
    });

    it('uses custom matcher function', () => {
      const customMatcher = (input: string, target: string) => (target.startsWith(input) ? 100 : 0);

      const result = filterItems(items, 'act', getTargets, { matcher: customMatcher });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('active');
    });
  });

  describe('minScore option', () => {
    it('respects minScore option', () => {
      const lowThreshold = filterItems(items, 'a', getTargets, { minScore: 1 });
      const highThreshold = filterItems(items, 'a', getTargets, { minScore: 50 });

      expect(lowThreshold.length).toBeGreaterThan(highThreshold.length);
    });

    it('excludes items below minScore', () => {
      // With exact matcher and partial input, nothing should match
      const result = filterItems(items, 'act', getTargets, { matcher: exact, minScore: 100 });
      expect(result).toEqual([]);
    });
  });

  describe('getTargets callback', () => {
    it('matches against multiple targets', () => {
      // 'Review' only appears in name, not id
      const result = filterItems(items, 'Review', getTargets);
      expect(result.some((item) => item.id === 'pending')).toBe(true);
    });

    it('works with single target', () => {
      const result = filterItems(items, 'pending', (item) => [item.id]);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('pending');
    });

    it('handles empty targets array', () => {
      const result = filterItems(items, 'test', () => []);
      expect(result).toEqual([]);
    });

    it('handles targets with null/undefined values', () => {
      const itemsWithOptional = [
        { id: 'test', name: 'Test', optional: undefined },
        { id: 'test2', name: 'Test2', optional: 'match' },
      ];

      const result = filterItems(itemsWithOptional, 'match', (item) => [
        item.id,
        item.optional as string,
      ]);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('test2');
    });
  });

  describe('combined options', () => {
    it('applies matcher and minScore together', () => {
      const result = filterItems(items, 'act', getTargets, {
        matcher: fuzzy,
        minScore: 1,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].id).toBe('active');
    });
  });
});
