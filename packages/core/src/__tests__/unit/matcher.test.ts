import { describe, expect, it } from 'vitest';
import {
  caseInsensitive,
  defaultMatcher,
  exact,
  fuzzy,
  matchBest,
  matchers,
  prefix,
} from '../../utils/matcher';

describe('matcher', () => {
  describe('exact', () => {
    it('returns 100 for exact match', () => {
      expect(exact('active', 'active')).toBe(100);
    });

    it('returns 0 for case mismatch', () => {
      expect(exact('Active', 'active')).toBe(0);
    });

    it('returns 0 for partial match', () => {
      expect(exact('act', 'active')).toBe(0);
    });

    it('returns 0 for no match', () => {
      expect(exact('inactive', 'active')).toBe(0);
    });
  });

  describe('caseInsensitive', () => {
    it('returns 100 for exact match ignoring case', () => {
      expect(caseInsensitive('ACTIVE', 'active')).toBe(100);
    });

    it('returns 100 for same case match', () => {
      expect(caseInsensitive('active', 'active')).toBe(100);
    });

    it('returns 0 for partial match', () => {
      expect(caseInsensitive('act', 'active')).toBe(0);
    });

    it('returns 0 for no match', () => {
      expect(caseInsensitive('inactive', 'active')).toBe(0);
    });
  });

  describe('prefix', () => {
    it('returns 80+ for prefix match', () => {
      expect(prefix('act', 'active')).toBeGreaterThanOrEqual(80);
    });

    it('adds case bonus for exact case match', () => {
      const withCaseBonus = prefix('Act', 'Active');
      const withoutCaseBonus = prefix('act', 'Active');
      expect(withCaseBonus).toBeGreaterThan(withoutCaseBonus);
    });

    it('returns 0 for non-prefix match', () => {
      expect(prefix('tive', 'active')).toBe(0);
    });

    it('returns 0 for no match', () => {
      expect(prefix('xyz', 'active')).toBe(0);
    });
  });

  describe('fuzzy', () => {
    it('returns 100 for exact match', () => {
      expect(fuzzy('active', 'active')).toBe(100);
    });

    it('returns 100 for case-insensitive exact match', () => {
      expect(fuzzy('ACTIVE', 'active')).toBe(100);
    });

    it('returns positive score for subsequence match', () => {
      const score = fuzzy('acv', 'active');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    it('returns higher score for consecutive matches', () => {
      const consecutiveScore = fuzzy('act', 'active');
      const nonConsecutiveScore = fuzzy('atv', 'active');
      expect(consecutiveScore).toBeGreaterThan(nonConsecutiveScore);
    });

    it('returns higher score for start matches', () => {
      const startScore = fuzzy('ac', 'active');
      const middleScore = fuzzy('ti', 'active');
      expect(startScore).toBeGreaterThan(middleScore);
    });

    it('returns higher score for word boundary matches', () => {
      const boundaryScore = fuzzy('us', 'united-states');
      const nonBoundaryScore = fuzzy('te', 'united-states');
      expect(boundaryScore).toBeGreaterThanOrEqual(nonBoundaryScore);
    });

    it('returns 0 for non-subsequence', () => {
      expect(fuzzy('xyz', 'active')).toBe(0);
    });

    it('returns 0 for empty input', () => {
      expect(fuzzy('', 'active')).toBe(0);
    });
  });

  describe('matchBest', () => {
    it('returns highest score from multiple targets', () => {
      const score = matchBest(exact, 'active', 'inactive', 'active', 'pending');
      expect(score).toBe(100);
    });

    it('returns 0 when no targets match', () => {
      const score = matchBest(exact, 'xyz', 'active', 'inactive');
      expect(score).toBe(0);
    });

    it('returns 0 for empty targets', () => {
      expect(matchBest(exact, 'active')).toBe(0);
    });

    it('filters out null/undefined targets', () => {
      const score = matchBest(
        exact,
        'active',
        null as unknown as string,
        'active',
        undefined as unknown as string
      );
      expect(score).toBe(100);
    });

    it('returns 0 when all targets are null/undefined', () => {
      const score = matchBest(
        exact,
        'active',
        null as unknown as string,
        undefined as unknown as string
      );
      expect(score).toBe(0);
    });

    it('works with fuzzy matcher', () => {
      const score = matchBest(fuzzy, 'act', 'label', 'active');
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('matchers namespace', () => {
    it('contains all built-in matchers', () => {
      expect(matchers.exact).toBe(exact);
      expect(matchers.caseInsensitive).toBe(caseInsensitive);
      expect(matchers.prefix).toBe(prefix);
      expect(matchers.fuzzy).toBe(fuzzy);
    });
  });

  describe('defaultMatcher', () => {
    it('is fuzzy matcher', () => {
      expect(defaultMatcher).toBe(fuzzy);
    });
  });
});
