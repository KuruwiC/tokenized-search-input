import { describe, expect, it } from 'vitest';
import type { QuerySnapshot, QuerySnapshotFilterToken } from '../../types';
import { diffSnapshots } from '../../utils/token-events';

describe('Token Events (Observer Pattern)', () => {
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

  const createSnapshot = (
    filters: QuerySnapshotFilterToken[],
    text: string = ''
  ): QuerySnapshot => ({
    segments: filters,
    text,
  });

  describe('diffSnapshots', () => {
    it('returns empty array when snapshots are identical', () => {
      const token = createFilterToken('1', 'status', 'is', 'active');
      const prev = createSnapshot([token]);
      const next = createSnapshot([token]);

      expect(diffSnapshots(prev, next)).toEqual([]);
    });

    it('detects created tokens', () => {
      const prev = createSnapshot([]);
      const token = createFilterToken('1', 'status', 'is', 'active');
      const next = createSnapshot([token]);

      const events = diffSnapshots(prev, next);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'create', token });
    });

    it('detects deleted tokens', () => {
      const token = createFilterToken('1', 'status', 'is', 'active');
      const prev = createSnapshot([token]);
      const next = createSnapshot([]);

      const events = diffSnapshots(prev, next);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'delete', tokenId: '1' });
    });

    it('detects updated token value', () => {
      const tokenV1 = createFilterToken('1', 'status', 'is', 'active');
      const tokenV2 = createFilterToken('1', 'status', 'is', 'inactive');
      const prev = createSnapshot([tokenV1]);
      const next = createSnapshot([tokenV2]);

      const events = diffSnapshots(prev, next);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'update', token: tokenV2 });
    });

    it('detects updated token operator', () => {
      const tokenV1 = createFilterToken('1', 'status', 'is', 'active');
      const tokenV2 = createFilterToken('1', 'status', 'is_not', 'active');
      const prev = createSnapshot([tokenV1]);
      const next = createSnapshot([tokenV2]);

      const events = diffSnapshots(prev, next);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'update', token: tokenV2 });
    });

    it('handles multiple events at once', () => {
      const token1 = createFilterToken('1', 'status', 'is', 'active');
      const token2 = createFilterToken('2', 'user', 'is', 'john');
      const token3 = createFilterToken('3', 'priority', 'is', 'high');
      const token2Updated = createFilterToken('2', 'user', 'is', 'jane');

      const prev = createSnapshot([token1, token2]);
      const next = createSnapshot([token2Updated, token3]);

      const events = diffSnapshots(prev, next);

      // Sort events by type for consistent testing
      const creates = events.filter((e) => e.type === 'create');
      const deletes = events.filter((e) => e.type === 'delete');
      const updates = events.filter((e) => e.type === 'update');

      expect(creates).toHaveLength(1);
      expect(creates[0]).toEqual({ type: 'create', token: token3 });

      expect(deletes).toHaveLength(1);
      expect(deletes[0]).toEqual({ type: 'delete', tokenId: '1' });

      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual({ type: 'update', token: token2Updated });
    });

    it('ignores non-filter segments', () => {
      const filter = createFilterToken('1', 'status', 'is', 'active');
      const prev: QuerySnapshot = {
        segments: [
          filter,
          { type: 'plaintext', value: ' ' },
          { type: 'freeText', id: '2', value: 'search' },
        ],
        text: 'status:is:active search',
      };
      const next: QuerySnapshot = {
        segments: [filter, { type: 'plaintext', value: ' more text' }],
        text: 'status:is:active more text',
      };

      const events = diffSnapshots(prev, next);
      expect(events).toEqual([]);
    });
  });
});
