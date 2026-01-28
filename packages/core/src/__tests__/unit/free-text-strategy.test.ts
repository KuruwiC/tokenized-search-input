/**
 * Unit tests for free text parsing strategies (tokenize, plain, none).
 */
import { describe, expect, it } from 'vitest';
import {
  freeTextStrategies,
  getFreeTextStrategy,
  type ParsedFreeTextToken,
} from '../../editor/auto-tokenize/free-text-strategy';

describe('FreeTextStrategy', () => {
  describe('tokenize strategy', () => {
    const strategy = freeTextStrategies.tokenize;

    it('converts unquoted token to freeTextToken node', () => {
      const token: ParsedFreeTextToken = {
        type: 'freeText',
        value: 'searchterm',
        quoted: false,
      };

      const result = strategy.toDocContent(token);

      expect(result).toEqual({
        type: 'freeTextToken',
        attrs: {
          // nanoid (21 chars) or UUID v4 (36 chars with dashes)
          id: expect.stringMatching(/^([A-Za-z0-9_-]{21}|[a-f0-9-]{36})$/),
          value: 'searchterm',
          quoted: false,
        },
      });
    });

    it('converts quoted token to freeTextToken node with quoted=true', () => {
      const token: ParsedFreeTextToken = {
        type: 'freeText',
        value: 'hello world',
        quoted: true,
        rawText: '"hello world"',
      };

      const result = strategy.toDocContent(token);

      expect(result).toEqual({
        type: 'freeTextToken',
        attrs: {
          // nanoid (21 chars) or UUID v4 (36 chars with dashes)
          id: expect.stringMatching(/^([A-Za-z0-9_-]{21}|[a-f0-9-]{36})$/),
          value: 'hello world',
          quoted: true,
        },
      });
    });
  });

  describe('plain strategy', () => {
    const strategy = freeTextStrategies.plain;

    it('converts unquoted token to text node', () => {
      const token: ParsedFreeTextToken = {
        type: 'freeText',
        value: 'searchterm',
        quoted: false,
      };

      const result = strategy.toDocContent(token);

      expect(result).toEqual({
        type: 'text',
        text: 'searchterm',
      });
    });

    it('converts quoted token to text node with quotes', () => {
      const token: ParsedFreeTextToken = {
        type: 'freeText',
        value: 'hello world',
        quoted: true,
      };

      const result = strategy.toDocContent(token);

      expect(result).toEqual({
        type: 'text',
        text: '"hello world"',
      });
    });

    it('escapes quotes in quoted token value', () => {
      const token: ParsedFreeTextToken = {
        type: 'freeText',
        value: 'say "hello"',
        quoted: true,
      };

      const result = strategy.toDocContent(token);

      expect(result).toEqual({
        type: 'text',
        text: '"say \\"hello\\""',
      });
    });
  });

  describe('none strategy', () => {
    const strategy = freeTextStrategies.none;

    it('returns null for any token', () => {
      const token: ParsedFreeTextToken = {
        type: 'freeText',
        value: 'searchterm',
        quoted: false,
      };

      const result = strategy.toDocContent(token);

      expect(result).toBeNull();
    });

    it('returns null for quoted token', () => {
      const token: ParsedFreeTextToken = {
        type: 'freeText',
        value: 'hello world',
        quoted: true,
      };

      const result = strategy.toDocContent(token);

      expect(result).toBeNull();
    });
  });

  describe('getFreeTextStrategy', () => {
    it('returns tokenize strategy for tokenize mode', () => {
      const strategy = getFreeTextStrategy('tokenize');
      expect(strategy).toBe(freeTextStrategies.tokenize);
    });

    it('returns plain strategy for plain mode', () => {
      const strategy = getFreeTextStrategy('plain');
      expect(strategy).toBe(freeTextStrategies.plain);
    });

    it('returns none strategy for none mode', () => {
      const strategy = getFreeTextStrategy('none');
      expect(strategy).toBe(freeTextStrategies.none);
    });
  });
});
