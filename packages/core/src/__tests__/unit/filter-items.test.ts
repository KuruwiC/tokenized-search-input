import { describe, expect, it } from 'vitest';
import { filterItems } from '../../utils/filter-items';
import { exact, fuzzy, matchBest } from '../../utils/matcher';

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

    it('uses custom matcher function', () => {
      const customMatcher = (input: string, target: string) => (target.startsWith(input) ? 1 : 0);

      const result = filterItems(items, 'act', getTargets, { matcher: customMatcher });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('active');
    });
  });

  describe('minScore option', () => {
    it('respects minScore option', () => {
      // fuzzy scores 'a': active 0.31, archived 0.29, inactive 0.11, pending 0
      expect(filterItems(items, 'a', getTargets, { minScore: 0 })).toEqual([
        items[0],
        items[3],
        items[1],
      ]);
      expect(filterItems(items, 'a', getTargets, { minScore: 0.2 })).toEqual([items[0], items[3]]);
    });

    it('excludes items below minScore', () => {
      const inactiveScore = matchBest(fuzzy, 'act', ...getTargets(items[1]));
      expect(inactiveScore).toBeGreaterThan(0);
      expect(inactiveScore).toBeLessThan(0.4);
      expect(filterItems(items, 'act', getTargets, { matcher: fuzzy, minScore: 0.4 })).toEqual([
        items[0],
      ]);
    });
  });

  describe('getTargets callback', () => {
    it('matches against multiple targets', () => {
      // 'Review' only appears in name, not id
      expect(filterItems(items, 'Review', getTargets)).toEqual([items[2]]);
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
});
