import { describe, expect, it } from 'vitest';
import type { QuerySnapshotFilterToken, QuerySnapshotFreeTextToken } from '../../types';
import { areTokenListsEqual, type ComparableToken, confirmTokens } from '../../utils/token-events';

/** Whether `current` confirms the same tokens as `confirmed`, as onTokensChange decides. */
function isUnchanged(
  confirmed: readonly ComparableToken[],
  current: readonly ComparableToken[],
  focusedId: string | null
): boolean {
  return areTokenListsEqual(confirmed, confirmTokens(confirmed, current, focusedId));
}

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

  describe('without a focused token', () => {
    it('returns true for identical lists', () => {
      const token = createFilterToken('1', 'status', 'is', 'active');
      expect(isUnchanged([token], [token], null)).toBe(true);
    });

    it('returns true for empty lists', () => {
      expect(isUnchanged([], [], null)).toBe(true);
    });

    it('returns false when lengths differ', () => {
      const token = createFilterToken('1', 'status', 'is', 'active');
      expect(isUnchanged([token], [], null)).toBe(false);
      expect(isUnchanged([], [token], null)).toBe(false);
    });

    it('returns false when id differs', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('2', 'status', 'is', 'active');
      expect(isUnchanged([token1], [token2], null)).toBe(false);
    });

    it('returns false when key differs', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('1', 'priority', 'is', 'active');
      expect(isUnchanged([token1], [token2], null)).toBe(false);
    });

    it('returns false when operator differs', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('1', 'status', 'is_not', 'active');
      expect(isUnchanged([token1], [token2], null)).toBe(false);
    });

    it('returns false when value differs', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('1', 'status', 'is', 'inactive');
      expect(isUnchanged([token1], [token2], null)).toBe(false);
    });

    it('returns false when type differs', () => {
      const filterToken = createFilterToken('1', 'status', 'is', 'active');
      const freeTextToken = createFreeTextToken('1', 'active');
      expect(isUnchanged([filterToken], [freeTextToken], null)).toBe(false);
    });

    it('compares multiple tokens in order', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('2', 'user', 'is', 'john');
      const token2Updated = createFilterToken('2', 'user', 'is', 'jane');

      expect(isUnchanged([token1, token2], [token1, token2], null)).toBe(true);
      expect(isUnchanged([token1, token2], [token1, token2Updated], null)).toBe(false);
    });

    it('handles mixed token types', () => {
      const filter = createFilterToken('1', 'status', 'is', 'active');
      const freeText = createFreeTextToken('2', 'hello');

      expect(isUnchanged([filter, freeText], [filter, freeText], null)).toBe(true);
    });

    it('compares freeText tokens correctly', () => {
      const token1 = createFreeTextToken('1', 'hello');
      const token2 = createFreeTextToken('1', 'world');
      expect(isUnchanged([token1], [token2], null)).toBe(false);
    });
  });

  describe('with a focused token', () => {
    it('returns true when focused token is excluded from both and rest is equal', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      const tokenB = createFilterToken('B', 'user', 'is', 'john');
      const tokenAEdited = createFilterToken('A', 'status', 'is', 'inactive');

      expect(isUnchanged([tokenA, tokenB], [tokenAEdited, tokenB], 'A')).toBe(true);
    });

    it('returns false when non-focused token changes', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      const tokenB = createFilterToken('B', 'user', 'is', 'john');
      const tokenBEdited = createFilterToken('B', 'user', 'is', 'jane');

      expect(isUnchanged([tokenA, tokenB], [tokenA, tokenBEdited], 'A')).toBe(false);
    });

    it('returns true when focused token is newly created', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(isUnchanged([], [tokenA], 'A')).toBe(true);
    });

    it('returns false when new token is created and focus left', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(isUnchanged([], [tokenA], null)).toBe(false);
    });

    it('returns false when a token is deleted', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(isUnchanged([tokenA], [], null)).toBe(false);
    });

    it('returns true when re-focusing an existing token', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      expect(isUnchanged([tokenA], [tokenA], 'A')).toBe(true);
    });

    it('handles null focusedTokenId (compares all tokens)', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      const tokenAEdited = createFilterToken('A', 'status', 'is', 'inactive');
      expect(isUnchanged([tokenA], [tokenAEdited], null)).toBe(false);
    });

    it('handles freeText token exclusion', () => {
      const filter = createFilterToken('A', 'status', 'is', 'active');
      const freeText = createFreeTextToken('B', 'hello');
      const freeTextEdited = createFreeTextToken('B', 'world');

      expect(isUnchanged([filter, freeText], [filter, freeTextEdited], 'B')).toBe(true);
    });

    it('keeps the confirmed form of the focused token while another token changes', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      const tokenB = createFilterToken('B', 'user', 'is', 'john');
      const tokenAEdited = createFilterToken('A', 'status', 'is', 'inactive');
      const tokenBEdited = createFilterToken('B', 'user', 'is', 'jane');

      const confirmed = confirmTokens([tokenA, tokenB], [tokenAEdited, tokenBEdited], 'A');

      expect(confirmed).toEqual([tokenA, tokenBEdited]);
      expect(isUnchanged(confirmed, [tokenAEdited, tokenBEdited], null)).toBe(false);
    });

    it('scenario: create token, focus out, re-focus, edit, focus out', () => {
      const tokenA = createFilterToken('A', 'status', 'is', 'active');
      let confirmed: ComparableToken[] = [];

      // 1. Create token A (focused) - no fire
      expect(isUnchanged(confirmed, [tokenA], 'A')).toBe(true);

      // 2. Focus out - fire!
      expect(isUnchanged(confirmed, [tokenA], null)).toBe(false);
      confirmed = [tokenA];

      // 3. Re-focus on A - no fire
      expect(isUnchanged(confirmed, [tokenA], 'A')).toBe(true);

      // 4. Edit A while focused - no fire
      const tokenAEdited = createFilterToken('A', 'status', 'is', 'inactive');
      expect(isUnchanged(confirmed, [tokenAEdited], 'A')).toBe(true);

      // 5. Focus out - fire!
      expect(isUnchanged(confirmed, [tokenAEdited], null)).toBe(false);
    });
  });
});
