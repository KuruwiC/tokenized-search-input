/**
 * Unit tests for spacer deletion helper functions.
 *
 * Tests the pure functions used to compute deletion ranges with spacer expansion.
 * These functions are used by both validation (plan-executor) and token-spacing (empty-token-cleanup).
 */
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import {
  applySpacerDeletion,
  checkBoundaryNeedsSpace,
  expandSelectionForDeletion,
  expandWithSpacers,
} from '../../plugins/token-spacing/helpers';
import { inlineSchema as schema } from '../fixtures';

/**
 * Helper to get a node at position with assertion.
 * Throws if node is not found (test will fail with clear message).
 */
function getNodeAt(doc: ProseMirrorNode, pos: number): ProseMirrorNode {
  const node = doc.nodeAt(pos);
  if (!node) {
    throw new Error(`Expected node at position ${pos}, but got null`);
  }
  return node;
}

describe('Spacer Deletion Helpers', () => {
  describe('expandWithSpacers', () => {
    it('expands deletion range to include leading and trailing spacers', () => {
      // Document: [spacer][token][spacer]
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      const tokenPos = 1; // After first spacer
      const tokenNode = getNodeAt(doc, tokenPos);
      expect(tokenNode.type.name).toBe('filterToken');

      const result = expandWithSpacers(doc, tokenPos, tokenNode.nodeSize);

      // Should expand to include both spacers
      expect(result.from).toBe(0); // Start of document (includes leading spacer)
      expect(result.to).toBe(doc.content.size); // End of document (includes trailing spacer)
      expect(result.needsSpaceSeparator).toBe(false); // No text on either side
    });

    it('detects when space separator is needed between text nodes', () => {
      // Document: hello[spacer][token][spacer]world
      const doc = schema.node('doc', null, [
        schema.text('hello'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.text('world'),
      ]);

      // Find token position
      const tokenPos = 'hello'.length + 1; // After 'hello' + spacer
      const tokenNode = getNodeAt(doc, tokenPos);
      expect(tokenNode.type.name).toBe('filterToken');

      const result = expandWithSpacers(doc, tokenPos, tokenNode.nodeSize);

      // Should expand to include both spacers
      expect(result.from).toBe('hello'.length); // Position after 'hello'
      expect(result.to).toBe('hello'.length + 1 + tokenNode.nodeSize + 1); // After token + trailing spacer
      expect(result.needsSpaceSeparator).toBe(true); // Text on both sides
    });

    it('handles document start (no leading spacer)', () => {
      // Document: [token][spacer]
      const doc = schema.node('doc', null, [
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      const tokenPos = 0;
      const tokenNode = getNodeAt(doc, tokenPos);
      expect(tokenNode.type.name).toBe('filterToken');

      const result = expandWithSpacers(doc, tokenPos, tokenNode.nodeSize);

      // Should only include trailing spacer
      expect(result.from).toBe(0); // No change to start
      expect(result.to).toBe(tokenNode.nodeSize + 1); // Token + trailing spacer
      expect(result.needsSpaceSeparator).toBe(false);
    });

    it('handles document end (no trailing spacer)', () => {
      // Document: [spacer][token]
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
      ]);

      const tokenPos = 1; // After spacer
      const tokenNode = getNodeAt(doc, tokenPos);
      expect(tokenNode.type.name).toBe('filterToken');

      const result = expandWithSpacers(doc, tokenPos, tokenNode.nodeSize);

      // Should only include leading spacer
      expect(result.from).toBe(0); // Includes leading spacer
      expect(result.to).toBe(1 + tokenNode.nodeSize); // No trailing spacer to include
      expect(result.needsSpaceSeparator).toBe(false);
    });

    it('handles text only on leading side', () => {
      // Document: hello[spacer][token][spacer]
      const doc = schema.node('doc', null, [
        schema.text('hello'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      const tokenPos = 'hello'.length + 1;
      const tokenNode = getNodeAt(doc, tokenPos);

      const result = expandWithSpacers(doc, tokenPos, tokenNode.nodeSize);

      // Only text before, no text after
      expect(result.needsSpaceSeparator).toBe(false);
    });

    it('handles text only on trailing side', () => {
      // Document: [spacer][token][spacer]world
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.text('world'),
      ]);

      const tokenPos = 1;
      const tokenNode = getNodeAt(doc, tokenPos);

      const result = expandWithSpacers(doc, tokenPos, tokenNode.nodeSize);

      // Only text after, no text before
      expect(result.needsSpaceSeparator).toBe(false);
    });
  });

  describe('checkBoundaryNeedsSpace', () => {
    it('returns true when text exists on both boundaries', () => {
      // Document: hello[spacer][token][spacer]world
      const doc = schema.node('doc', null, [
        schema.text('hello'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.text('world'),
      ]);

      // Range from after 'hello' to before 'world'
      const from = 'hello'.length;
      const tokenNode = getNodeAt(doc, 'hello'.length + 1);
      const to = 'hello'.length + 1 + tokenNode.nodeSize + 1;

      const result = checkBoundaryNeedsSpace(doc, from, to);
      expect(result).toBe(true);
    });

    it('returns false when no text before', () => {
      // Document: [spacer][token][spacer]world
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.text('world'),
      ]);

      const tokenNode = getNodeAt(doc, 1);
      const from = 0;
      const to = 1 + tokenNode.nodeSize + 1;

      const result = checkBoundaryNeedsSpace(doc, from, to);
      expect(result).toBe(false);
    });

    it('returns false when no text after', () => {
      // Document: hello[spacer][token][spacer]
      const doc = schema.node('doc', null, [
        schema.text('hello'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      const from = 'hello'.length;
      const to = doc.content.size;

      const result = checkBoundaryNeedsSpace(doc, from, to);
      expect(result).toBe(false);
    });

    it('returns false for empty document positions', () => {
      const doc = schema.node('doc', null, []);

      const result = checkBoundaryNeedsSpace(doc, 0, 0);
      expect(result).toBe(false);
    });
  });

  describe('applySpacerDeletion', () => {
    it('deletes range when no space separator needed', () => {
      // Document: [spacer][token][spacer]
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
      ]);

      const state = EditorState.create({ doc, schema });
      const tr = state.tr;

      applySpacerDeletion(tr, schema, {
        from: 0,
        to: doc.content.size,
        needsSpaceSeparator: false,
      });

      expect(tr.doc.content.size).toBe(0);
    });

    it('replaces range with space when separator needed', () => {
      // Document: hello[spacer][token][spacer]world
      const doc = schema.node('doc', null, [
        schema.text('hello'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.text('world'),
      ]);

      const state = EditorState.create({ doc, schema });
      const tr = state.tr;

      const tokenNode = getNodeAt(doc, 'hello'.length + 1);
      const from = 'hello'.length;
      const to = 'hello'.length + 1 + tokenNode.nodeSize + 1;

      applySpacerDeletion(tr, schema, { from, to, needsSpaceSeparator: true });

      // Result should be "hello world"
      expect(tr.doc.textContent).toBe('hello world');
    });

    it('handles empty range gracefully', () => {
      const doc = schema.node('doc', null, [schema.text('hello')]);

      const state = EditorState.create({ doc, schema });
      const tr = state.tr;

      // Delete nothing
      applySpacerDeletion(tr, schema, { from: 2, to: 2, needsSpaceSeparator: false });

      // Document unchanged
      expect(tr.doc.textContent).toBe('hello');
    });
  });

  describe('Multiple token deletion scenarios', () => {
    it('handles adjacent tokens with proper spacer expansion', () => {
      // Document: [spacer][tokenA][spacer][tokenB][spacer]
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'priority', operator: 'is', value: 'high' }),
        schema.node('spacer'),
      ]);

      const tokenAPos = 1;
      const tokenA = getNodeAt(doc, tokenAPos);
      const tokenBPos = tokenAPos + tokenA.nodeSize + 1; // After tokenA + middle spacer
      const tokenB = getNodeAt(doc, tokenBPos);

      // Expand both tokens
      const rangeA = expandWithSpacers(doc, tokenAPos, tokenA.nodeSize);
      const rangeB = expandWithSpacers(doc, tokenBPos, tokenB.nodeSize);

      // Range A should include leading spacer and middle spacer
      expect(rangeA.from).toBe(0);
      expect(rangeA.to).toBe(tokenAPos + tokenA.nodeSize + 1);

      // Range B should include middle spacer and trailing spacer
      expect(rangeB.from).toBe(tokenBPos - 1);
      expect(rangeB.to).toBe(doc.content.size);
    });

    it('handles text between tokens', () => {
      // Document: [spacer][tokenA][spacer]text[spacer][tokenB][spacer]
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.text('text'),
        schema.node('spacer'),
        schema.node('filterToken', { key: 'priority', operator: 'is', value: 'high' }),
        schema.node('spacer'),
      ]);

      const tokenAPos = 1;
      const tokenA = getNodeAt(doc, tokenAPos);
      const resultA = expandWithSpacers(doc, tokenAPos, tokenA.nodeSize);

      // Token A has text after the trailing spacer
      // So needsSpaceSeparator should be false (text is after the spacer, not directly adjacent)
      expect(resultA.needsSpaceSeparator).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('handles freeTextToken the same as filterToken', () => {
      // Document: [spacer][freeTextToken][spacer]
      const doc = schema.node('doc', null, [
        schema.node('spacer'),
        schema.node('freeTextToken', { value: 'search term', quoted: false }),
        schema.node('spacer'),
      ]);

      const tokenPos = 1;
      const tokenNode = getNodeAt(doc, tokenPos);
      expect(tokenNode.type.name).toBe('freeTextToken');

      const result = expandWithSpacers(doc, tokenPos, tokenNode.nodeSize);

      // Should expand to include both spacers
      expect(result.from).toBe(0);
      expect(result.to).toBe(doc.content.size);
    });

    it('handles single spacer without token', () => {
      // Document: [spacer]
      const doc = schema.node('doc', null, [schema.node('spacer')]);

      // This is an edge case - trying to expand a spacer itself
      // The function expects a token position, but let's ensure it doesn't crash
      const spacerPos = 0;
      const spacerNode = getNodeAt(doc, spacerPos);

      const result = expandWithSpacers(doc, spacerPos, spacerNode.nodeSize);

      // Should return the spacer's range without expansion
      expect(result.from).toBe(0);
      expect(result.to).toBe(1);
    });

    it('handles text nodes with existing whitespace', () => {
      // Document: "hello "[spacer][token][spacer]" world"
      const doc = schema.node('doc', null, [
        schema.text('hello '), // Trailing space
        schema.node('spacer'),
        schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
        schema.node('spacer'),
        schema.text(' world'), // Leading space
      ]);

      const tokenPos = 'hello '.length + 1;
      const tokenNode = getNodeAt(doc, tokenPos);

      const result = expandWithSpacers(doc, tokenPos, tokenNode.nodeSize);

      // Even though text has whitespace, the function doesn't check content
      // It only checks if text nodes exist
      expect(result.needsSpaceSeparator).toBe(true);
    });
  });
});

describe('expandSelectionForDeletion', () => {
  it('returns null when no expansion needed', () => {
    // Document: hello world (just text)
    const doc = schema.node('doc', null, [schema.text('hello world')]);

    const result = expandSelectionForDeletion(doc, 0, 5);

    expect(result).toBeNull();
  });

  it('expands to include token before spacer in selection', () => {
    // Document: [spacer][tokenA][spacer][spacer][tokenB][spacer]
    // Selection includes only the middle spacers
    const doc = schema.node('doc', null, [
      schema.node('spacer'),
      schema.node('filterToken', { key: 'a', operator: 'is', value: '1' }),
      schema.node('spacer'),
      schema.node('spacer'),
      schema.node('filterToken', { key: 'b', operator: 'is', value: '2' }),
      schema.node('spacer'),
    ]);

    // Select from after tokenA to before tokenB (the two middle spacers)
    const tokenAEnd = 1 + 1; // spacer + token
    const tokenBStart = tokenAEnd + 1 + 1; // + 2 spacers
    const result = expandSelectionForDeletion(doc, tokenAEnd, tokenBStart);

    // Should expand to include tokenA (with its leading spacer) and tokenB (with its trailing spacer)
    expect(result).not.toBeNull();
    if (result) {
      expect(result.from).toBe(0); // Include leading spacer of tokenA
      expect(result.to).toBe(doc.content.size); // Include trailing spacer of tokenB
    }
  });

  it('expands to include token after spacer in selection', () => {
    // Document: text[spacer][token][spacer]
    const doc = schema.node('doc', null, [
      schema.text('text'),
      schema.node('spacer'),
      schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
      schema.node('spacer'),
    ]);

    // Select from middle of text to after the first spacer
    const spacerPos = 'text'.length;
    const result = expandSelectionForDeletion(doc, 2, spacerPos + 1);

    // Should expand to include the token and its trailing spacer
    expect(result).not.toBeNull();
    if (result) {
      expect(result.to).toBe(doc.content.size);
    }
  });

  it('does not expand when selection is entirely within text', () => {
    // Document: [spacer][token][spacer]hello world
    const doc = schema.node('doc', null, [
      schema.node('spacer'),
      schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
      schema.node('spacer'),
      schema.text('hello world'),
    ]);

    // Select only within the text portion
    const textStart = 1 + 1 + 1; // spacer + token + spacer
    const result = expandSelectionForDeletion(doc, textStart + 2, textStart + 5);

    expect(result).toBeNull();
  });

  it('handles document boundary correctly', () => {
    // Document: [spacer][token][spacer]
    const doc = schema.node('doc', null, [
      schema.node('spacer'),
      schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
      schema.node('spacer'),
    ]);

    // Select the entire document
    const result = expandSelectionForDeletion(doc, 0, doc.content.size);

    // Already covers everything, no expansion needed
    expect(result).toBeNull();
  });
});
