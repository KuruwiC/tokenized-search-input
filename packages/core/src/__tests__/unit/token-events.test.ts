import { describe, expect, it } from 'vitest';
import type { QuerySnapshotFilterToken, QuerySnapshotFreeTextToken } from '../../types';
import {
  areTokenListsEqual,
  areTokenListsEqualExcludingFocused,
  type ComparableToken,
} from '../../utils/token-events';

describe('Token Events', () => {
  const createFilterToken = (
    id: string,
    key: string,
    operator: string,
    value: string
  ): QuerySnapshotFilterToken => ({
    type: 'filter',
    id,
    key,
    operator,
    value,
  });

  const createFreeTextToken = (id: string, value: string): QuerySnapshotFreeTextToken => ({
    type: 'freeText',
    id,
    value,
  });

  describe('areTokenListsEqual', () => {
    it('returns true for identical lists', () => {
      const token = createFilterToken('1', 'status', 'is', 'active');
      expect(areTokenListsEqual([token], [token])).toBe(true);
    });

    it('returns true for empty lists', () => {
      expect(areTokenListsEqual([], [])).toBe(true);
    });

    it('returns false when lengths differ', () => {
      const token = createFilterToken('1', 'status', 'is', 'active');
      expect(areTokenListsEqual([token], [])).toBe(false);
      expect(areTokenListsEqual([], [token])).toBe(false);
    });

    it('returns false when id differs', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('2', 'status', 'is', 'active');
      expect(areTokenListsEqual([token1], [token2])).toBe(false);
    });

    it('returns false when operator differs', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('1', 'status', 'is_not', 'active');
      expect(areTokenListsEqual([token1], [token2])).toBe(false);
    });

    it('returns false when value differs', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('1', 'status', 'is', 'inactive');
      expect(areTokenListsEqual([token1], [token2])).toBe(false);
    });

    it('returns false when type differs', () => {
      const filterToken = createFilterToken('1', 'status', 'is', 'active');
      const freeTextToken = createFreeTextToken('1', 'active');
      expect(areTokenListsEqual([filterToken], [freeTextToken])).toBe(false);
    });

    it('compares multiple tokens in order', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('2', 'user', 'is', 'john');
      const token2Updated = createFilterToken('2', 'user', 'is', 'jane');

      expect(areTokenListsEqual([token1, token2], [token1, token2])).toBe(true);
      expect(areTokenListsEqual([token1, token2], [token1, token2Updated])).toBe(false);
    });

    it('handles mixed token types', () => {
      const filter = createFilterToken('1', 'status', 'is', 'active');
      const freeText = createFreeTextToken('2', 'hello');

      expect(areTokenListsEqual([filter, freeText], [filter, freeText])).toBe(true);
    });

    it('compares freeText tokens correctly', () => {
      const token1 = createFreeTextToken('1', 'hello');
      const token2 = createFreeTextToken('1', 'world');
      expect(areTokenListsEqual([token1], [token2])).toBe(false);
    });
  });

  describe('areTokenListsEqualExcludingFocused', () => {
    it('returns true when focused token is excluded from both and rest is equal', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      const tokenB = createFilterToken('B', 'user', 'is', 'john');
      const tokenAEdited = createFilterToken('A', 'status', 'is', 'inactive');

      expect(
        areTokenListsEqualExcludingFocused([tokenA, tokenB], [tokenAEdited, tokenB], 'A')
      ).toBe(true);
    });

    it('returns false when non-focused token changes', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      const tokenB = createFilterToken('B', 'user', 'is', 'john');
      const tokenBEdited = createFilterToken('B', 'user', 'is', 'jane');

      expect(
        areTokenListsEqualExcludingFocused([tokenA, tokenB], [tokenA, tokenBEdited], 'A')
      ).toBe(false);
    });

    it('returns true when focused token is newly created', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(areTokenListsEqualExcludingFocused([], [tokenA], 'A')).toBe(true);
    });

    it('returns false when new token is created and focus left', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(areTokenListsEqualExcludingFocused([], [tokenA], null)).toBe(false);
    });

    it('returns false when a token is deleted', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(areTokenListsEqualExcludingFocused([tokenA], [], null)).toBe(false);
    });

    it('returns true when re-focusing an existing token', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(areTokenListsEqualExcludingFocused([tokenA], [tokenA], 'A')).toBe(true);
    });

    it('handles null focusedTokenId (compares all tokens)', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      const tokenAEdited = createFilterToken('A', 'status', 'is', 'inactive');
      expect(areTokenListsEqualExcludingFocused([tokenA], [tokenAEdited], null)).toBe(false);
    });

    it('handles freeText token exclusion', () => {
      const filter = createFilterToken('A', 'status', 'is', 'active');
      const freeText = createFreeTextToken('B', 'hello');
      const freeTextEdited = createFreeTextToken('B', 'world');

      expect(
        areTokenListsEqualExcludingFocused([filter, freeText], [filter, freeTextEdited], 'B')
      ).toBe(true);
    });

    it('scenario: create token, focus out, re-focus, edit, focus out', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      let confirmed: ComparableToken[] = [];

      // 1. Create token A (focused) - no fire
      expect(areTokenListsEqualExcludingFocused(confirmed, [tokenA], 'A')).toBe(true);

      // 2. Focus out - fire!
      expect(areTokenListsEqualExcludingFocused(confirmed, [tokenA], null)).toBe(false);
      confirmed = [tokenA];

      // 3. Re-focus on A - no fire
      expect(areTokenListsEqualExcludingFocused(confirmed, [tokenA], 'A')).toBe(true);

      // 4. Edit A while focused - no fire
      const tokenAEdited = createFilterToken('A', 'status', 'is', 'inactive');
      expect(areTokenListsEqualExcludingFocused(confirmed, [tokenAEdited], 'A')).toBe(true);

      // 5. Focus out - fire!
      expect(areTokenListsEqualExcludingFocused(confirmed, [tokenAEdited], null)).toBe(false);
    });
  });
});
