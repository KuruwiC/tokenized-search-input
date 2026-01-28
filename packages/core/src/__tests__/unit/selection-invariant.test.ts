/**
 * Unit tests for Selection Invariant Enforcer.
 *
 * Tests the core algorithm that determines when to focus tokens
 * based on cursor position and movement direction.
 *
 * INVARIANT: Cursor can be on a spacer, but entering a token requires explicit action.
 *
 * Behavior based on move direction:
 * - moveDirection > 0 (right): If cursor is directly before a token, focus it at start
 * - moveDirection < 0 (left): If cursor is directly after a token, focus it at end
 * - moveDirection = 0 (unknown/click): No action (spacer is a valid cursor position)
 */
import { describe, expect, it } from 'vitest';
import { enforceSelectionInvariant } from '../../plugins/token-spacing/selection-invariant';
import { inlineSchema as schema } from '../fixtures';

describe('enforceSelectionInvariant', () => {
  describe('moveDirection > 0 (moving right)', () => {
    it('focuses token when cursor is directly before it', () => {
      // Document structure: [spacer][token][spacer]
      // Positions: 0 | spacer | 1 | token | 2 | spacer | 3
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      // Cursor at position 1 (directly before token)
      const cursorPos = 1;
      const result = enforceSelectionInvariant(doc, cursorPos, 1);

      expect(result).toEqual({
        type: 'focus',
        tokenPos: cursorPos,
        cursor: { direction: 'from-left', policy: 'all' },
      });
    });

    it('returns null when cursor is not at token boundary', () => {
      // Document: [spacer][token][spacer][spacer][token][spacer]
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'type', operator: 'is', value: 'bug' }),
        schema.node('spacer'),
      ]);

      // Cursor at position 3 (between two spacers, not before token)
      const cursorPos = 3;
      const result = enforceSelectionInvariant(doc, cursorPos, 1);

      expect(result).toBeNull();
    });

    it('returns null when cursor is at document start with no token ahead', () => {
      // Document: [spacer]
      const doc = schema.node('doc', null, [schema.node('spacer')]);

      // Cursor at start
      const result = enforceSelectionInvariant(doc, 0, 1);

      expect(result).toBeNull();
    });
  });

  describe('moveDirection < 0 (moving left)', () => {
    it('focuses token when cursor is directly after it', () => {
      // Document structure: [spacer][token][spacer]
      // Positions: 0 | spacer | 1 | token | 2 | spacer | 3
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      // Cursor at position 2 (directly after token)
      const cursorPos = 2;
      const result = enforceSelectionInvariant(doc, cursorPos, -1);

      // Token starts at position 1, nodeSize is 1 (atom node)
      expect(result).toEqual({
        type: 'focus',
        tokenPos: 1, // cursorPos - nodeBefore.nodeSize = 2 - 1 = 1
        cursor: { direction: 'from-right', policy: 'all' },
      });
    });

    it('returns null when cursor is not at token boundary', () => {
      // Document: [spacer][spacer]
      const doc = schema.node('doc', null, [schema.node('spacer'), schema.node('spacer')]);

      // Cursor between spacers
      const cursorPos = 1;
      const result = enforceSelectionInvariant(doc, cursorPos, -1);

      expect(result).toBeNull();
    });
  });

  describe('moveDirection = 0 (click/unknown)', () => {
    it('returns null even when cursor is at token boundary', () => {
      // Document: [spacer][token][spacer]
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      // Cursor directly before token
      const cursorBeforeToken = 1;
      const result1 = enforceSelectionInvariant(doc, cursorBeforeToken, 0);
      expect(result1).toBeNull();

      // Cursor directly after token
      const cursorAfterToken = 2;
      const result2 = enforceSelectionInvariant(doc, cursorAfterToken, 0);
      expect(result2).toBeNull();
    });

    it('spacer is a valid cursor position without triggering token focus', () => {
      // Document: [spacer][token][spacer][spacer][token][spacer]
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'type', operator: 'is', value: 'bug' }),
        schema.node('spacer'),
      ]);

      // Cursor between spacers (valid click position)
      const cursorPos = 3;
      const result = enforceSelectionInvariant(doc, cursorPos, 0);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles invalid position gracefully', () => {
      const doc = schema.node('doc', null, [schema.node('spacer')]);

      // Out of bounds position
      const result = enforceSelectionInvariant(doc, 9999, 1);
      expect(result).toBeNull();
    });

    it('handles freeTextToken the same as filterToken', () => {
      // Document: [spacer][freeTextToken][spacer]
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('freeTextToken', { value: 'hello', quoted: false }),
        schema.node('spacer'),
      ]);

      // Moving right into freeTextToken
      const result = enforceSelectionInvariant(doc, 1, 1);
      expect(result).toEqual({
        type: 'focus',
        tokenPos: 1,
        cursor: { direction: 'from-left', policy: 'all' },
      });
    });

    it('correctly calculates tokenPos when moving left into multi-char token', () => {
      // In ProseMirror, atom nodes have nodeSize of 1 regardless of content
      // This test ensures we use the actual nodeSize for position calculation
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'verylongfieldname', operator: 'is', value: 'value' }),
        schema.node('spacer'),
      ]);

      // Token is at position 1, nodeSize is 1 (atom)
      // Cursor after token at position 2
      const cursorPos = 2;
      const result = enforceSelectionInvariant(doc, cursorPos, -1);

      expect(result?.type).toBe('focus');
      if (result?.type === 'focus') {
        expect(result.tokenPos).toBe(1);
      }
    });
  });

  describe('text nodes do not trigger focus', () => {
    it('does not focus plain text when moving right', () => {
      // Document: [text]
      const doc = schema.node('doc', null, [schema.text('hello world')]);

      // Moving right through text
      const result = enforceSelectionInvariant(doc, 5, 1);
      expect(result).toBeNull();
    });

    it('does not focus plain text when moving left', () => {
      // Document: [text]
      const doc = schema.node('doc', null, [schema.text('hello world')]);

      // Moving left through text
      const result = enforceSelectionInvariant(doc, 5, -1);
      expect(result).toBeNull();
    });
  });
});
