/**
 * Unit tests for calculateShiftClickHead.
 *
 * Tests the head position calculation for Shift+click range selection.
 * calculateShiftClickHead determines the selection head based on:
 * - Whether the click was on a token or spacer (clickedOnToken parameter)
 * - Selection direction (anchor vs clickPos)
 *
 * Key behaviors:
 * - Clicking on spacer: returns clickPos (spacer acts as boundary)
 * - Clicking on token: includes that token in the selection
 */
import { describe, expect, it } from 'vitest';
import { calculateShiftClickHead } from '../../plugins/selection-guard/click-resolver';
import { inlineSchema as schema } from '../fixtures';

describe('calculateShiftClickHead', () => {
  describe('spacer clicks (clickedOnToken=false)', () => {
    it('returns clickPos when clicking on spacer before token (forward)', () => {
      // Document: [spacer][token][spacer]
      // Positions: 0 | spacer | 1 | token | 2 | spacer | 3
      // Click on spacer at boundary, anchor=0, click=1 → head=1
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      const result = calculateShiftClickHead(doc, 1, 0, false);

      expect(result).toBe(1);
    });

    it('returns clickPos when clicking on spacer after token (backward)', () => {
      // Document: [spacer][token][spacer]
      // Positions: 0 | spacer | 1 | token | 2 | spacer | 3
      // Click on spacer at boundary, anchor=3, click=2 → head=2
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      const result = calculateShiftClickHead(doc, 2, 3, false);

      expect(result).toBe(2);
    });

    it('returns clickPos when clicking between spacers', () => {
      // Document: [spacer][spacer][token][spacer]
      // Positions: 0 | spacer | 1 | spacer | 2 | token | 3 | spacer | 4
      // anchor=0, click=1 → head=1
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      const result = calculateShiftClickHead(doc, 1, 0, false);

      expect(result).toBe(1);
    });

    it('returns clickPos when clicking on trailing spacers', () => {
      // Document: [token][spacer][spacer]
      // Positions: 0 | token | 1 | spacer | 2 | spacer | 3
      // anchor=3, click=2 → head=2
      const doc = schema.node('doc', null, [
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.node('spacer'),
      ]);

      const result = calculateShiftClickHead(doc, 2, 3, false);

      expect(result).toBe(2);
    });
  });

  describe('token clicks (clickedOnToken=true)', () => {
    it('includes token in forward selection when clicking on token', () => {
      // Document: [spacer][token][spacer]
      // Positions: 0 | spacer | 1 | token | 2 | spacer | 3
      // Click on token (left half returns pos=1), anchor=0 → head=2 (token end)
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      const result = calculateShiftClickHead(doc, 1, 0, true);

      expect(result).toBe(2);
    });

    it('includes token in backward selection when clicking on token', () => {
      // Document: [spacer][token][spacer]
      // Positions: 0 | spacer | 1 | token | 2 | spacer | 3
      // Click on token (right half returns pos=2), anchor=3 → head=1 (token start)
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      const result = calculateShiftClickHead(doc, 2, 3, true);

      expect(result).toBe(1);
    });

    it('includes correct token in multiple token document (forward)', () => {
      // Document: [spacer][token1][spacer][spacer][token2][spacer]
      // Positions: 0|sp|1|tok1|2|sp|3|sp|4|tok2|5|sp|6
      // Click on token2 (left half returns pos=4), anchor=0 → head=5 (token2 end)
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'type', operator: 'is', value: 'bug' }),
        schema.node('spacer'),
      ]);

      const result = calculateShiftClickHead(doc, 4, 0, true);

      expect(result).toBe(5);
    });

    it('includes correct token in multiple token document (backward)', () => {
      // Document: [spacer][token1][spacer][spacer][token2][spacer]
      // Positions: 0|sp|1|tok1|2|sp|3|sp|4|tok2|5|sp|6
      // Click on token1 (right half returns pos=2), anchor=6 → head=1 (token1 start)
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'type', operator: 'is', value: 'bug' }),
        schema.node('spacer'),
      ]);

      const result = calculateShiftClickHead(doc, 2, 6, true);

      expect(result).toBe(1);
    });
  });

  describe('multiple tokens with spacer clicks', () => {
    it('returns clickPos on spacer before token2 (forward selection)', () => {
      // Document: [spacer][token1][spacer][spacer][token2][spacer]
      // Positions: 0|sp|1|tok1|2|sp|3|sp|4|tok2|5|sp|6
      // Click on spacer at pos=4, anchor=0 → head=4 (don't include token2)
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'type', operator: 'is', value: 'bug' }),
        schema.node('spacer'),
      ]);

      const result = calculateShiftClickHead(doc, 4, 0, false);

      expect(result).toBe(4);
    });

    it('returns clickPos on spacer after token1 (backward selection)', () => {
      // Document: [spacer][token1][spacer][spacer][token2][spacer]
      // Positions: 0|sp|1|tok1|2|sp|3|sp|4|tok2|5|sp|6
      // Click on spacer at pos=2, anchor=6 → head=2 (don't include token1)
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'type', operator: 'is', value: 'bug' }),
        schema.node('spacer'),
      ]);

      const result = calculateShiftClickHead(doc, 2, 6, false);

      expect(result).toBe(2);
    });

    it('returns clickPos on spacer between tokens', () => {
      // Document: [spacer][token1][spacer][spacer][token2][spacer]
      // Positions: 0|sp|1|tok1|2|sp|3|sp|4|tok2|5|sp|6
      // anchor=0, click=3 → head=3
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'type', operator: 'is', value: 'bug' }),
        schema.node('spacer'),
      ]);

      const result = calculateShiftClickHead(doc, 3, 0, false);

      expect(result).toBe(3);
    });
  });

  describe('token-to-token boundary (without spacer)', () => {
    it('includes token in forward selection when clicking on token', () => {
      // Document: [token1][token2]
      // Positions: 0 | token1 | 1 | token2 | 2
      // Click on token2, anchor=0, click=1 → head=2 (includes token2)
      const doc = schema.node('doc', null, [
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('filterToken', { key: 'type', operator: 'is', value: 'bug' }),
      ]);

      const result = calculateShiftClickHead(doc, 1, 0, true);

      expect(result).toBe(2);
    });

    it('includes token in backward selection when clicking on token', () => {
      // Document: [token1][token2]
      // Positions: 0 | token1 | 1 | token2 | 2
      // Click on token1, anchor=2, click=1 → head=0 (includes token1)
      const doc = schema.node('doc', null, [
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('filterToken', { key: 'type', operator: 'is', value: 'bug' }),
      ]);

      const result = calculateShiftClickHead(doc, 1, 2, true);

      expect(result).toBe(0);
    });
  });

  describe('plain text areas', () => {
    it('returns null for plain text', () => {
      const doc = schema.node('doc', null, [schema.text('hello')]);

      const result = calculateShiftClickHead(doc, 3, 0, false);

      expect(result).toBeNull();
    });

    it('returns null at document start with only text', () => {
      const doc = schema.node('doc', null, [schema.text('hello')]);

      const result = calculateShiftClickHead(doc, 0, 0, false);

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null for empty document', () => {
      const doc = schema.node('doc', null, []);

      const result = calculateShiftClickHead(doc, 0, 0, false);

      expect(result).toBeNull();
    });

    it('handles single spacer document', () => {
      const doc = schema.node('doc', null, [schema.node('spacer')]);

      // Forward: anchor=0, click=0
      expect(calculateShiftClickHead(doc, 0, 0, false)).toBe(0);
      // Forward: anchor=0, click=1
      expect(calculateShiftClickHead(doc, 1, 0, false)).toBe(1);
      // Backward: anchor=1, click=0
      expect(calculateShiftClickHead(doc, 0, 1, false)).toBe(0);
    });

    it('handles invalid position gracefully', () => {
      const doc = schema.node('doc', null, [schema.node('spacer')]);

      const result = calculateShiftClickHead(doc, 999, 0, false);

      expect(result).toBeNull();
    });
  });
});
