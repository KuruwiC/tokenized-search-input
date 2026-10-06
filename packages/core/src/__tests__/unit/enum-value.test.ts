import { describe, expect, it } from 'vitest';
import {
  enumResolvers,
  filterEnumValues,
  getEnumIcon,
  getEnumLabel,
  getEnumValue,
  isEnumValueWithLabel,
  resolveEnumValue,
} from '../../utils/enum-value';
import { exact } from '../../utils/matcher';

describe('enum-value utilities', () => {
  describe('isEnumValueWithLabel', () => {
    it('returns true for object with value and label', () => {
      expect(isEnumValueWithLabel({ value: 'test', label: 'Test' })).toBe(true);
    });

    it('returns false for string', () => {
      expect(isEnumValueWithLabel('test')).toBe(false);
    });
  });

  describe('getEnumValue', () => {
    it('returns value from object', () => {
      expect(getEnumValue({ value: 'test', label: 'Test' })).toBe('test');
    });

    it('returns string as-is', () => {
      expect(getEnumValue('test')).toBe('test');
    });
  });

  describe('getEnumLabel', () => {
    it('returns label from object', () => {
      expect(getEnumLabel({ value: 'test', label: 'Test Label' })).toBe('Test Label');
    });

    it('returns string as-is', () => {
      expect(getEnumLabel('test')).toBe('test');
    });
  });

  describe('getEnumIcon', () => {
    it('returns icon from object', () => {
      const icon = 'test-icon';
      expect(getEnumIcon({ value: 'test', label: 'Test', icon })).toBe(icon);
    });

    it('returns undefined for object without icon', () => {
      expect(getEnumIcon({ value: 'test', label: 'Test' })).toBeUndefined();
    });

    it('returns undefined for string', () => {
      expect(getEnumIcon('test')).toBeUndefined();
    });
  });

  describe('filterEnumValues', () => {
    const enumValues = [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ];

    it('returns all values for empty query', () => {
      expect(filterEnumValues(enumValues, '')).toEqual(enumValues);
      expect(filterEnumValues(enumValues, '  ')).toEqual(enumValues);
    });

    it('returns empty array for undefined enumValues', () => {
      expect(filterEnumValues(undefined, 'test')).toEqual([]);
    });

    it('returns empty array for empty enumValues', () => {
      expect(filterEnumValues([], 'test')).toEqual([]);
    });

    it('filters by fuzzy match (default)', () => {
      const result = filterEnumValues(enumValues, 'act');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((ev) => getEnumValue(ev) === 'active')).toBe(true);
    });

    it('sorts results by score (highest first)', () => {
      const result = filterEnumValues(enumValues, 'act');
      // 'active' should be first as it starts with 'act'
      expect(getEnumValue(result[0])).toBe('active');
    });

    it('uses specified matcher', () => {
      // With exact matcher, 'act' won't match 'active'
      const exactResult = filterEnumValues(enumValues, 'act', { matcher: exact });
      expect(exactResult).toEqual([]);

      // Full value should match
      const exactFullResult = filterEnumValues(enumValues, 'active', { matcher: exact });
      expect(exactFullResult.length).toBe(1);
      expect(getEnumValue(exactFullResult[0])).toBe('active');
    });

    it('respects minScore option', () => {
      const lowThreshold = filterEnumValues(enumValues, 'a', { minScore: 0 });
      const highThreshold = filterEnumValues(enumValues, 'a', { minScore: 0.5 });

      expect(lowThreshold.length).toBeGreaterThan(highThreshold.length);
    });

    it('uses custom matcher function', () => {
      const customMatcher = (input: string, value: string) => (value.startsWith(input) ? 1 : 0);

      const result = filterEnumValues(enumValues, 'act', { matcher: customMatcher });
      expect(result.length).toBe(1);
      expect(getEnumValue(result[0])).toBe('active');
    });

    it('matches on the label as well as on the value', () => {
      const labelled = [
        { value: 'p1', label: 'Urgent' },
        { value: 'p2', label: 'Normal' },
      ];

      expect(filterEnumValues(labelled, 'urg')).toEqual([labelled[0]]);
      expect(filterEnumValues(labelled, 'Urgent', { matcher: exact })).toEqual([labelled[0]]);
      expect(filterEnumValues(labelled, 'p2', { matcher: exact })).toEqual([labelled[1]]);
    });
  });

  describe('resolveEnumValue', () => {
    const enumValues = [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ];

    it('returns original input for empty input', () => {
      expect(resolveEnumValue(enumValues, '')).toBe('');
    });

    it('returns original input for empty enumValues', () => {
      expect(resolveEnumValue([], 'test')).toBe('test');
    });

    it('resolves exact value match', () => {
      expect(resolveEnumValue(enumValues, 'active')).toBe('active');
    });

    it('resolves exact label match', () => {
      expect(resolveEnumValue(enumValues, 'Active')).toBe('active');
    });

    it('resolves case-insensitive exact match', () => {
      // Case-insensitive matching
      expect(resolveEnumValue(enumValues, 'ACTIVE')).toBe('active');
      expect(resolveEnumValue(enumValues, 'INACTIVE')).toBe('inactive');
      expect(resolveEnumValue(enumValues, 'Pending')).toBe('pending');
    });

    it('does NOT resolve partial matches (unlike fuzzy)', () => {
      // 'act' should NOT match 'active' - this is a lookup, not fuzzy search
      expect(resolveEnumValue(enumValues, 'act')).toBe('act');
      expect(resolveEnumValue(enumValues, 'activ')).toBe('activ');
    });

    it('returns original input when no match', () => {
      expect(resolveEnumValue(enumValues, 'xyz')).toBe('xyz');
    });

    it('prioritizes first item when both value and label match different items', () => {
      const valuesWithSameLabel = [
        { value: 'first', label: 'Test' },
        { value: 'second', label: 'Test' },
      ];
      // Both have exact label match, first should win
      expect(resolveEnumValue(valuesWithSameLabel, 'Test')).toBe('first');
    });

    it('resolves input equal to an option value to that option, wherever another option names it as a label', () => {
      const valueFirst = [
        { value: 'test', label: 'Label1' },
        { value: 'other', label: 'test' },
      ];
      expect(resolveEnumValue(valueFirst, 'test')).toBe('test');

      const labelFirst = [
        { value: 'other', label: 'test' },
        { value: 'test', label: 'Label1' },
      ];
      expect(resolveEnumValue(labelFirst, 'test')).toBe('test');
    });

    it('resolves a label to its option when no option has the input as its value', () => {
      const enumValues = [
        { value: 'a', label: 'b' },
        { value: 'b', label: 'Bee' },
      ];
      expect(resolveEnumValue(enumValues, 'Bee')).toBe('b');
    });

    it('resolves a looser match of a value by option order, after an earlier label', () => {
      const enumValues = [
        { value: 'a', label: 'b' },
        { value: 'b', label: 'Bee' },
      ];
      // 'B' equals no value, so options are tried in order and the label 'b' of 'a' comes first
      expect(resolveEnumValue(enumValues, 'B')).toBe('a');
      expect(resolveEnumValue(enumValues, 'b')).toBe('b');
    });

    it('calls the resolver only with the options as given', () => {
      const enumValues = [
        { value: 'x', label: 'Bee' },
        { value: 'y', label: 'B' },
      ];
      const seen: { value: string; label: string }[] = [];
      const labelPrefix = (ctx: { query: string; option: { value: string; label: string } }) => {
        seen.push(ctx.option);
        return ctx.query.startsWith(ctx.option.label) ? ctx.option.value : null;
      };
      expect(resolveEnumValue(enumValues, 'Zed', { resolver: labelPrefix })).toBe('Zed');
      expect(resolveEnumValue(enumValues, 'Beetle', { resolver: labelPrefix })).toBe('x');
      expect(resolveEnumValue(enumValues, 'Bz', { resolver: labelPrefix })).toBe('y');
      expect(seen.length).toBeGreaterThan(0);
      for (const option of seen) expect(enumValues).toContainEqual(option);
    });

    it('resolves input equal to an option value to that option with a custom resolver', () => {
      const enumValues = [
        { value: 'a', label: 'b' },
        { value: 'b', label: 'Bee' },
      ];
      expect(resolveEnumValue(enumValues, 'b', { resolver: enumResolvers.exact })).toBe('b');
      expect(resolveEnumValue(enumValues, 'b', { resolver: () => null })).toBe('b');
    });

    describe('custom resolver', () => {
      it('uses case-sensitive resolver when specified', () => {
        const enumValues = [
          { value: 'active', label: 'Active' },
          { value: 'ACTIVE', label: 'ACTIVE Label' },
        ];

        // Default (case-insensitive): 'Active' matches the first item's label;
        // 'ACTIVE' is the second item's value, which wins over any case-insensitive match
        expect(resolveEnumValue(enumValues, 'Active')).toBe('active');
        expect(resolveEnumValue(enumValues, 'ACTIVE')).toBe('ACTIVE');

        // Case-sensitive: 'ACTIVE' matches second item exactly
        expect(resolveEnumValue(enumValues, 'ACTIVE', { resolver: enumResolvers.exact })).toBe(
          'ACTIVE'
        );

        // Case-sensitive: 'active' matches first item exactly
        expect(resolveEnumValue(enumValues, 'active', { resolver: enumResolvers.exact })).toBe(
          'active'
        );
      });

      it('case-sensitive resolver returns original when no exact match', () => {
        const enumValues = [{ value: 'active', label: 'Active' }];

        // 'ACTIVE' does not match 'active' case-sensitively
        expect(resolveEnumValue(enumValues, 'ACTIVE', { resolver: enumResolvers.exact })).toBe(
          'ACTIVE'
        );
      });

      it('uses custom resolver function', () => {
        const enumValues = [
          { value: 'a1', label: 'Alpha One' },
          { value: 'b2', label: 'Beta Two' },
        ];

        // Custom resolver: match by first character only
        const firstCharResolver = (ctx: {
          query: string;
          option: { value: string; label: string };
        }) =>
          ctx.query[0]?.toLowerCase() === ctx.option.value[0]?.toLowerCase()
            ? ctx.option.value
            : null;

        expect(resolveEnumValue(enumValues, 'anything', { resolver: firstCharResolver })).toBe(
          'a1'
        );
        expect(resolveEnumValue(enumValues, 'beta', { resolver: firstCharResolver })).toBe('b2');
        expect(resolveEnumValue(enumValues, 'xyz', { resolver: firstCharResolver })).toBe('xyz');
      });
    });
  });
});
