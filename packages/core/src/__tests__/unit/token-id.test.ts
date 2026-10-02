import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureTokenId, generateTokenId } from '../../utils/token-id';

const UUID_V4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

describe('generateTokenId', () => {
  it('returns a UUID v4', () => {
    expect(generateTokenId()).toMatch(UUID_V4);
  });

  it('returns a distinct id on every call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTokenId()));
    expect(ids.size).toBe(100);
  });
});

describe('generateTokenId without crypto.randomUUID', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a UUID v4 from getRandomValues alone', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: <T extends ArrayBufferView>(array: T): T => {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0xff);
        return array;
      },
    });
    expect(generateTokenId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });
});

describe('ensureTokenId', () => {
  it('keeps an existing id', () => {
    expect(ensureTokenId('existing-id')).toBe('existing-id');
  });

  it('generates an id for missing values', () => {
    expect(ensureTokenId(null)).toMatch(UUID_V4);
    expect(ensureTokenId('')).toMatch(UUID_V4);
  });
});
