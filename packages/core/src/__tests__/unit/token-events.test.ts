import { describe, expect, it } from 'vitest';
import type { QuerySnapshotFilterToken } from '../../types';
import {
  areFilterTokenListsEqual,
  areFilterTokenListsEqualExcludingFocused,
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

  describe('areFilterTokenListsEqual', () => {
    it('returns true for identical lists', () => {
      const token = createFilterToken('1', 'status', 'is', 'active');
      expect(areFilterTokenListsEqual([token], [token])).toBe(true);
    });

    it('returns true for empty lists', () => {
      expect(areFilterTokenListsEqual([], [])).toBe(true);
    });

    it('returns false when lengths differ', () => {
      const token = createFilterToken('1', 'status', 'is', 'active');
      expect(areFilterTokenListsEqual([token], [])).toBe(false);
      expect(areFilterTokenListsEqual([], [token])).toBe(false);
    });

    it('returns false when id differs', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('2', 'status', 'is', 'active');
      expect(areFilterTokenListsEqual([token1], [token2])).toBe(false);
    });

    it('returns false when operator differs', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('1', 'status', 'is_not', 'active');
      expect(areFilterTokenListsEqual([token1], [token2])).toBe(false);
    });

    it('returns false when value differs', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('1', 'status', 'is', 'inactive');
      expect(areFilterTokenListsEqual([token1], [token2])).toBe(false);
    });

    it('ignores key differences', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('1', 'priority', 'is', 'active');
      expect(areFilterTokenListsEqual([token1], [token2])).toBe(true);
    });

    it('compares multiple tokens in order', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('2', 'user', 'is', 'john');
      const token2Updated = createFilterToken('2', 'user', 'is', 'jane');

      expect(areFilterTokenListsEqual([token1, token2], [token1, token2])).toBe(true);
      expect(areFilterTokenListsEqual([token1, token2], [token1, token2Updated])).toBe(false);
    });
  });

  describe('areFilterTokenListsEqualExcludingFocused', () => {
    it('returns true when focused token is excluded from both and rest is equal', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      const tokenB = createFilterToken('B', 'user', 'is', 'john');
      const tokenAEdited = createFilterToken('A', 'status', 'is', 'inactive');

      expect(
        areFilterTokenListsEqualExcludingFocused([tokenA, tokenB], [tokenAEdited, tokenB], 'A')
      ).toBe(true);
    });

    it('returns false when non-focused token changes', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      const tokenB = createFilterToken('B', 'user', 'is', 'john');
      const tokenBEdited = createFilterToken('B', 'user', 'is', 'jane');

      expect(
        areFilterTokenListsEqualExcludingFocused([tokenA, tokenB], [tokenA, tokenBEdited], 'A')
      ).toBe(false);
    });

    it('returns true when focused token is newly created', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(areFilterTokenListsEqualExcludingFocused([], [tokenA], 'A')).toBe(true);
    });

    it('returns false when new token is created and focus left', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(areFilterTokenListsEqualExcludingFocused([], [tokenA], null)).toBe(false);
    });

    it('returns false when a token is deleted', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(areFilterTokenListsEqualExcludingFocused([tokenA], [], null)).toBe(false);
    });

    it('returns true when re-focusing an existing token', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(areFilterTokenListsEqualExcludingFocused([tokenA], [tokenA], 'A')).toBe(true);
    });

    it('handles null focusedTokenId (compares all tokens)', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      const tokenAEdited = createFilterToken('A', 'status', 'is', 'inactive');
      expect(areFilterTokenListsEqualExcludingFocused([tokenA], [tokenAEdited], null)).toBe(false);
    });

    it('scenario: create token, focus out, re-focus, edit, focus out', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      let confirmed: QuerySnapshotFilterToken[] = [];

      // 1. Create token A (focused) - no fire
      expect(areFilterTokenListsEqualExcludingFocused(confirmed, [tokenA], 'A')).toBe(true);

      // 2. Focus out - fire!
      expect(areFilterTokenListsEqualExcludingFocused(confirmed, [tokenA], null)).toBe(false);
      confirmed = [tokenA];

      // 3. Re-focus on A - no fire
      expect(areFilterTokenListsEqualExcludingFocused(confirmed, [tokenA], 'A')).toBe(true);

      // 4. Edit A while focused - no fire
      const tokenAEdited = createFilterToken('A', 'status', 'is', 'inactive');
      expect(areFilterTokenListsEqualExcludingFocused(confirmed, [tokenAEdited], 'A')).toBe(true);

      // 5. Focus out - fire!
      expect(areFilterTokenListsEqualExcludingFocused(confirmed, [tokenAEdited], null)).toBe(false);
    });
  });
});
