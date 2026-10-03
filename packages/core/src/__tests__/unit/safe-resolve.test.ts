/**
 * Unit tests for safe-resolve utility.
 *
 * Tests the safe wrappers around doc.resolve() that handle
 * out-of-bounds positions gracefully.
 */
import { describe, expect, it } from 'vitest';
import { safeResolve } from '../../utils/safe-resolve';
import { inlineSchema as schema } from '../fixtures';

describe('safeResolve', () => {
  it('returns ResolvedPos for valid positions', () => {
    // Document: [free text][filter][free text]
    // Positions: 0 | free text | 1 | filter | 2 | free text | 3
    const doc = schema.node('doc', null, [
      schema.node('freeTextToken', { value: 'x' }),
      schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
      schema.node('freeTextToken', { value: 'x' }),
    ]);

    const result = safeResolve(doc, 1);
    expect(result).not.toBeNull();
    expect(result?.pos).toBe(1);
  });

  it('returns ResolvedPos for position 0', () => {
    const doc = schema.node('doc', null, [schema.node('freeTextToken', { value: 'x' })]);

    const result = safeResolve(doc, 0);
    expect(result).not.toBeNull();
    expect(result?.pos).toBe(0);
  });

  it('returns ResolvedPos for end position', () => {
    const doc = schema.node('doc', null, [schema.node('freeTextToken', { value: 'x' })]);

    // Position at end of doc
    const result = safeResolve(doc, 1);
    expect(result).not.toBeNull();
    expect(result?.pos).toBe(1);
  });

  it('returns null for negative positions', () => {
    const doc = schema.node('doc', null, [schema.node('freeTextToken', { value: 'x' })]);

    const result = safeResolve(doc, -1);
    expect(result).toBeNull();
  });

  it('returns null for out-of-bounds positions', () => {
    const doc = schema.node('doc', null, [schema.node('freeTextToken', { value: 'x' })]);

    const result = safeResolve(doc, 9999);
    expect(result).toBeNull();
  });

  it('returns null for positions just past document end', () => {
    // Document: [free text]
    // Valid positions: 0, 1
    const doc = schema.node('doc', null, [schema.node('freeTextToken', { value: 'x' })]);

    const result = safeResolve(doc, 2);
    expect(result).toBeNull();
  });
});
