import { describe, expect, it } from 'vitest';
import type {
  QuerySnapshot,
  QuerySnapshotFilterToken,
  QuerySnapshotFreeTextToken,
  QuerySnapshotPlainText,
} from '../../types';
import { getFilterTokens, getFreeTextTokens, getPlainText } from '../../utils/query-snapshot';

describe('QuerySnapshot helpers', () => {
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

  const createPlainText = (value: string): QuerySnapshotPlainText => ({
    type: 'plaintext',
    value,
  });

  describe('getFilterTokens', () => {
    it('returns empty array for snapshot with no segments', () => {
      const snapshot: QuerySnapshot = {
        segments: [],
        text: '',
      };
      expect(getFilterTokens(snapshot)).toEqual([]);
    });

    it('returns only filter tokens', () => {
      const filter1 = createFilterToken('1', 'status', 'is', 'active');
      const filter2 = createFilterToken('2', 'user', 'is', 'john');
      const snapshot: QuerySnapshot = {
        segments: [filter1, createFreeTextToken('3', 'search'), filter2, createPlainText(' ')],
        text: 'status:is:active search user:is:john ',
      };

      const result = getFilterTokens(snapshot);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(filter1);
      expect(result[1]).toEqual(filter2);
    });

    it('returns empty array when no filter tokens exist', () => {
      const snapshot: QuerySnapshot = {
        segments: [createFreeTextToken('1', 'search'), createPlainText(' term')],
        text: 'search term',
      };

      expect(getFilterTokens(snapshot)).toEqual([]);
    });
  });

  describe('getFreeTextTokens', () => {
    it('returns empty array for snapshot with no segments', () => {
      const snapshot: QuerySnapshot = {
        segments: [],
        text: '',
      };
      expect(getFreeTextTokens(snapshot)).toEqual([]);
    });

    it('returns only freetext tokens', () => {
      const freetext1 = createFreeTextToken('1', 'search');
      const freetext2 = createFreeTextToken('3', 'term');
      const snapshot: QuerySnapshot = {
        segments: [freetext1, createFilterToken('2', 'status', 'is', 'active'), freetext2],
        text: 'search status:is:active term',
      };

      const result = getFreeTextTokens(snapshot);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(freetext1);
      expect(result[1]).toEqual(freetext2);
    });

    it('returns empty array when no freetext tokens exist', () => {
      const snapshot: QuerySnapshot = {
        segments: [createFilterToken('1', 'status', 'is', 'active'), createPlainText(' ')],
        text: 'status:is:active ',
      };

      expect(getFreeTextTokens(snapshot)).toEqual([]);
    });
  });

  describe('getPlainText', () => {
    it('returns empty string for snapshot with no segments', () => {
      const snapshot: QuerySnapshot = {
        segments: [],
        text: '',
      };
      expect(getPlainText(snapshot)).toBe('');
    });

    it('returns concatenated plain text values', () => {
      const snapshot: QuerySnapshot = {
        segments: [
          createPlainText('hello '),
          createFilterToken('1', 'status', 'is', 'active'),
          createPlainText('world'),
        ],
        text: 'hello status:is:active world',
      };

      expect(getPlainText(snapshot)).toBe('hello world');
    });

    it('ignores filter and freetext tokens', () => {
      const snapshot: QuerySnapshot = {
        segments: [
          createFilterToken('1', 'status', 'is', 'active'),
          createFreeTextToken('2', 'search'),
          createPlainText('plain text'),
        ],
        text: 'status:is:active search plain text',
      };

      expect(getPlainText(snapshot)).toBe('plain text');
    });

    it('returns empty string when no plain text exists', () => {
      const snapshot: QuerySnapshot = {
        segments: [
          createFilterToken('1', 'status', 'is', 'active'),
          createFreeTextToken('2', 'search'),
        ],
        text: 'status:is:active search',
      };

      expect(getPlainText(snapshot)).toBe('');
    });
  });
});
