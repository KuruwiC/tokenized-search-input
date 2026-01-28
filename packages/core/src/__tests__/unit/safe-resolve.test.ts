/**
 * Unit tests for safe-resolve utility.
 *
 * Tests the safe wrappers around doc.resolve() that handle
 * out-of-bounds positions gracefully.
 */
import { describe, expect, it } from 'vitest';
import { getAdjacentNodes, safeResolve } from '../../utils/safe-resolve';
import { inlineSchema as schema } from '../fixtures';

describe('safeResolve', () => {
  it('returns ResolvedPos for valid positions', () => {
    // Document: [spacer][token][spacer]
    // Positions: 0 | spacer | 1 | token | 2 | spacer | 3
    const doc = schema.node('doc', null, [
      schema.node('spacer'),
      schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
      schema.node('spacer'),
    ]);

    const result = safeResolve(doc, 1);
    expect(result).not.toBeNull();
    expect(result?.pos).toBe(1);
  });

  it('returns ResolvedPos for position 0', () => {
    const doc = schema.node('doc', null, [schema.node('spacer')]);

    const result = safeResolve(doc, 0);
    expect(result).not.toBeNull();
    expect(result?.pos).toBe(0);
  });

  it('returns ResolvedPos for end position', () => {
    const doc = schema.node('doc', null, [schema.node('spacer')]);

    // Position at end of doc
    const result = safeResolve(doc, 1);
    expect(result).not.toBeNull();
    expect(result?.pos).toBe(1);
  });

  it('returns null for negative positions', () => {
    const doc = schema.node('doc', null, [schema.node('spacer')]);

    const result = safeResolve(doc, -1);
    expect(result).toBeNull();
  });

  it('returns null for out-of-bounds positions', () => {
    const doc = schema.node('doc', null, [schema.node('spacer')]);

    const result = safeResolve(doc, 9999);
    expect(result).toBeNull();
  });

  it('returns null for positions just past document end', () => {
    // Document: [spacer]
    // Valid positions: 0, 1
    const doc = schema.node('doc', null, [schema.node('spacer')]);

    const result = safeResolve(doc, 2);
    expect(result).toBeNull();
  });
});

describe('getAdjacentNodes', () => {
  it('returns adjacent nodes correctly at token boundary', () => {
    // Document: [spacer][token][spacer]
    // Positions: 0 | spacer | 1 | token | 2 | spacer | 3
    const doc = schema.node('doc', null, [
      schema.node('spacer'),
      schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
      schema.node('spacer'),
    ]);

    // Position 1: after spacer, before token
    const result1 = getAdjacentNodes(doc, 1);
    expect(result1).not.toBeNull();
    expect(result1?.nodeBefore?.type.name).toBe('spacer');
    expect(result1?.nodeAfter?.type.name).toBe('filterToken');

    // Position 2: after token, before spacer
    const result2 = getAdjacentNodes(doc, 2);
    expect(result2).not.toBeNull();
    expect(result2?.nodeBefore?.type.name).toBe('filterToken');
    expect(result2?.nodeAfter?.type.name).toBe('spacer');
  });

  it('returns null for nodeBefore at document start', () => {
    const doc = schema.node('doc', null, [schema.node('spacer')]);

    const result = getAdjacentNodes(doc, 0);
    expect(result).not.toBeNull();
    expect(result?.nodeBefore).toBeNull();
    expect(result?.nodeAfter?.type.name).toBe('spacer');
  });

  it('returns null for nodeAfter at document end', () => {
    const doc = schema.node('doc', null, [schema.node('spacer')]);

    const result = getAdjacentNodes(doc, 1);
    expect(result).not.toBeNull();
    expect(result?.nodeBefore?.type.name).toBe('spacer');
    expect(result?.nodeAfter).toBeNull();
  });

  it('returns null for invalid positions', () => {
    const doc = schema.node('doc', null, [schema.node('spacer')]);

    expect(getAdjacentNodes(doc, -1)).toBeNull();
    expect(getAdjacentNodes(doc, 9999)).toBeNull();
  });

  it('handles text nodes correctly', () => {
    // Document: [text]
    const doc = schema.node('doc', null, [schema.text('hello')]);

    // Position 3: middle of text (after 'hel', before 'lo')
    const result = getAdjacentNodes(doc, 3);
    expect(result).not.toBeNull();
    // Text nodes have different behavior - nodeBefore/After return parent context for text positions
  });

  it('handles empty document', () => {
    const doc = schema.node('doc', null, []);

    const result = getAdjacentNodes(doc, 0);
    expect(result).not.toBeNull();
    expect(result?.nodeBefore).toBeNull();
    expect(result?.nodeAfter).toBeNull();
  });
});
