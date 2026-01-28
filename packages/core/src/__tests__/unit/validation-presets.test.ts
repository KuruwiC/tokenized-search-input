import { describe, expect, it } from 'vitest';
import type {
  FieldDefinition,
  SimpleToken,
  ValidationContext,
  ValidationToken,
  Violation,
} from '../../types';
import { createFieldRule, createRule, RequireEnum } from '../../validation/presets';

// Helper to check if result has violations for a specific position
const hasViolationAt = (violations: Violation[], pos: number): boolean =>
  violations.some((v) => v.targets.some((t) => t.pos === pos));

// Helper to get violation positions
const getViolationPositions = (violations: Violation[]): number[] =>
  violations.flatMap((v) => v.targets.map((t) => t.pos));

describe('validation presets', () => {
  describe('RequireEnum', () => {
    const enumField: FieldDefinition = {
      key: 'status',
      label: 'Status',
      type: 'enum',
      operators: ['is'],
      enumValues: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'pending', label: 'Pending Review' },
      ],
    };

    const createContext = (
      tokenValue: string,
      fields: FieldDefinition[] = [enumField],
      key = 'status'
    ): ValidationContext => {
      const token: ValidationToken = {
        id: 'test-token-1',
        type: 'filter',
        pos: 0,
        key,
        operator: ':',
        value: tokenValue,
        rawValue: tokenValue,
      };
      const editingTokenIds = new Set<string>();
      return {
        tokens: [token],
        fields,
        editingTokenIds,
        isEditing: (t: ValidationToken) => editingTokenIds.has(t.id),
      };
    };

    const rule = RequireEnum.rule();

    describe('case-insensitive exact match', () => {
      it('accepts exact value match', () => {
        const result = rule.validate(createContext('active')) as Violation[];
        expect(result).toEqual([]);
      });

      it('accepts exact label match', () => {
        const result = rule.validate(createContext('Active')) as Violation[];
        expect(result).toEqual([]);
      });

      it('accepts case-insensitive value match', () => {
        const result = rule.validate(createContext('ACTIVE')) as Violation[];
        expect(result).toEqual([]);
      });

      it('accepts case-insensitive label match', () => {
        const result = rule.validate(createContext('INACTIVE')) as Violation[];
        expect(result).toEqual([]);
      });

      it('accepts label with spaces (case-insensitive)', () => {
        const result = rule.validate(createContext('pending review')) as Violation[];
        expect(result).toEqual([]);
      });

      it('accepts label with spaces (exact case)', () => {
        const result = rule.validate(createContext('Pending Review')) as Violation[];
        expect(result).toEqual([]);
      });
    });

    describe('rejects partial matches (not fuzzy)', () => {
      it('rejects partial value match', () => {
        const result = rule.validate(createContext('act')) as Violation[];
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].reason).toBe('invalid-enum-value');
      });

      it('rejects partial label match', () => {
        const result = rule.validate(createContext('Activ')) as Violation[];
        expect(result.length).toBeGreaterThan(0);
      });

      it('rejects prefix match', () => {
        const result = rule.validate(createContext('pend')) as Violation[];
        expect(result.length).toBeGreaterThan(0);
      });

      it('rejects fuzzy-style match', () => {
        const result = rule.validate(createContext('atv')) as Violation[];
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('edge cases', () => {
      it('returns empty array for non-enum field', () => {
        const textField: FieldDefinition = {
          key: 'name',
          label: 'Name',
          type: 'string',
          operators: ['is'],
        };
        const ctx = createContext('anything', [textField], 'name');
        const result = rule.validate(ctx) as Violation[];
        expect(result).toEqual([]);
      });

      it('returns empty array for empty value', () => {
        const result = rule.validate(createContext('')) as Violation[];
        expect(result).toEqual([]);
      });

      it('returns empty array for unknown field', () => {
        const ctx = createContext('test', []);
        const result = rule.validate(ctx) as Violation[];
        expect(result).toEqual([]);
      });

      it('rejects completely invalid value', () => {
        const result = rule.validate(createContext('nonexistent')) as Violation[];
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Status');
      });
    });

    describe('string enum values', () => {
      const stringEnumField: FieldDefinition = {
        key: 'priority',
        label: 'Priority',
        type: 'enum',
        operators: ['is'],
        enumValues: ['low', 'medium', 'high'],
      };

      it('accepts exact string value', () => {
        const ctx = createContext('low', [stringEnumField], 'priority');
        const result = rule.validate(ctx) as Violation[];
        expect(result).toEqual([]);
      });

      it('accepts case-insensitive string value', () => {
        const ctx = createContext('LOW', [stringEnumField], 'priority');
        const result = rule.validate(ctx) as Violation[];
        expect(result).toEqual([]);
      });

      it('rejects partial string value', () => {
        const ctx = createContext('lo', [stringEnumField], 'priority');
        const result = rule.validate(ctx) as Violation[];
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('custom options', () => {
      it('uses custom message', () => {
        const customRule = RequireEnum.rule(RequireEnum.mark, { message: 'Custom error message' });
        const result = customRule.validate(createContext('invalid')) as Violation[];
        expect(result[0].message).toBe('Custom error message');
      });

      it('uses reject strategy for editing tokens', () => {
        const customRule = RequireEnum.rule(RequireEnum.reject);
        // Create a context with an editing token
        const token: ValidationToken = {
          id: 'editing-token',
          type: 'filter',
          pos: 0,
          key: 'status',
          operator: ':',
          value: 'invalid',
          rawValue: 'invalid',
        };
        const editingTokenIds = new Set<string>(['editing-token']);
        const ctx: ValidationContext = {
          tokens: [token],
          fields: [enumField],
          editingTokenIds,
          isEditing: (t: ValidationToken) => editingTokenIds.has(t.id),
        };
        const result = customRule.validate(ctx) as Violation[];
        expect(result[0].action).toBe('delete');
      });

      it('sets custom priority', () => {
        const customRule = RequireEnum.rule(RequireEnum.mark, { priority: 100 });
        expect(customRule.priority).toBe(100);
      });
    });
  });

  describe('createRule', () => {
    const createContext = (
      tokens: Array<{ key: string; operator: string; value: string }>
    ): ValidationContext => {
      const validationTokens: ValidationToken[] = tokens.map((t, i) => ({
        id: `test-token-${i}`,
        type: 'filter' as const,
        pos: i * 10,
        key: t.key,
        operator: t.operator,
        value: t.value,
        rawValue: t.value,
      }));
      const editingTokenIds = new Set<string>();
      return {
        tokens: validationTokens,
        fields: [],
        editingTokenIds,
        isEditing: (t: ValidationToken) => editingTokenIds.has(t.id),
      };
    };

    describe('basic usage (SimpleValidationFn)', () => {
      it('returns empty array when validation passes (return null)', () => {
        const rule = createRule((token) => {
          if (token.value === 'valid') return null;
          return 'Invalid value';
        });

        const ctx = createContext([{ key: 'status', operator: ':', value: 'valid' }]);
        const result = rule.validate(ctx) as Violation[];
        expect(result).toEqual([]);
      });

      it('returns empty array when validation passes (return undefined)', () => {
        const rule = createRule((token) => {
          if (token.value !== 'valid') return 'Invalid value';
          // implicit undefined return
        });

        const ctx = createContext([{ key: 'status', operator: ':', value: 'valid' }]);
        const result = rule.validate(ctx) as Violation[];
        expect(result).toEqual([]);
      });

      it('returns violation with string message', () => {
        const rule = createRule((token) => {
          if (token.value === 'invalid') {
            return 'Value is invalid';
          }
        });

        const ctx = createContext([{ key: 'status', operator: ':', value: 'invalid' }]);
        const result = rule.validate(ctx) as Violation[];
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toBe('Value is invalid');
        expect(result[0].reason).toBe('custom');
      });

      it('can access all tokens for cross-validation', () => {
        const rule = createRule((token, allTokens) => {
          const count = allTokens.filter((t) => t.key === token.key).length;
          if (count > 1) {
            return 'Duplicate key';
          }
        });

        const ctx = createContext([
          { key: 'status', operator: ':', value: 'active' },
          { key: 'status', operator: ':', value: 'inactive' },
        ]);
        const result = rule.validate(ctx) as Violation[];
        // Both tokens have duplicates, so we expect violations for both
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toBe('Duplicate key');
      });

      it('uses custom id', () => {
        const rule = createRule(() => null, { id: 'my-custom-rule' });
        expect(rule.id).toBe('my-custom-rule');
      });

      it('uses default id when not specified', () => {
        const rule = createRule(() => null);
        expect(rule.id).toBe('custom-rule');
      });

      it('sets priority option', () => {
        const rule = createRule(() => null, { priority: 50 });
        expect(rule.priority).toBe(50);
      });
    });

    describe('extended usage (ExtendedValidationFn with currentIndex)', () => {
      it('provides currentIndex for delete-existing scenarios', () => {
        const rule = createRule(
          (token: SimpleToken, allTokens: SimpleToken[], currentIndex: number) => {
            if (token.key !== 'status') return null;

            const existingIndices = allTokens
              .map((t: SimpleToken, i: number) =>
                t.key === 'status' && i !== currentIndex ? i : -1
              )
              .filter((i: number) => i !== -1);

            if (existingIndices.length > 0) {
              return {
                message: 'Replacing existing status',
                deleteTargetIndices: existingIndices,
              };
            }
          }
        );

        const ctx = createContext([
          { key: 'status', operator: ':', value: 'old' },
          { key: 'tag', operator: ':', value: 'foo' },
          { key: 'status', operator: ':', value: 'new' },
        ]);
        const result = rule.validate(ctx) as Violation[];
        expect(result.length).toBeGreaterThan(0);
        // Token at index 0 (pos 0) and token at index 2 (pos 20) both trigger the rule
        // Token at index 0 targets index 2 (pos 20), token at index 2 targets index 0 (pos 0)
        expect(hasViolationAt(result, 0)).toBe(true);
      });

      it('converts deleteTargetIndices to violation targets correctly', () => {
        const rule = createRule(
          (_token: SimpleToken, _allTokens: SimpleToken[], _currentIndex: number) => {
            return {
              deleteTargetIndices: [0, 1],
            };
          }
        );

        const ctx = createContext([
          { key: 'a', operator: ':', value: '1' },
          { key: 'b', operator: ':', value: '2' },
          { key: 'c', operator: ':', value: '3' },
        ]);
        const result = rule.validate(ctx) as Violation[];
        // Each token triggers the rule, so we get violations for positions 0 and 10 (indices 0 and 1)
        const positions = getViolationPositions(result);
        expect(positions).toContain(0);
        expect(positions).toContain(10);
      });

      it('filters out invalid indices', () => {
        const rule = createRule(() => {
          return {
            deleteTargetIndices: [-1, 0, 100],
          };
        });

        const ctx = createContext([{ key: 'a', operator: ':', value: '1' }]);
        const result = rule.validate(ctx) as Violation[];
        const positions = getViolationPositions(result);
        expect(positions).toEqual([0]);
      });

      it('returns empty array when deleteTargetIndices is empty', () => {
        const rule = createRule(() => {
          return {
            deleteTargetIndices: [],
          };
        });

        const ctx = createContext([{ key: 'a', operator: ':', value: '1' }]);
        const result = rule.validate(ctx) as Violation[];
        expect(result).toEqual([]);
      });
    });
  });

  describe('createFieldRule', () => {
    const createContext = (
      tokens: Array<{ key: string; operator: string; value: string }>
    ): ValidationContext => {
      const validationTokens: ValidationToken[] = tokens.map((t, i) => ({
        id: `test-token-${i}`,
        type: 'filter' as const,
        pos: i * 10,
        key: t.key,
        operator: t.operator,
        value: t.value,
        rawValue: t.value,
      }));
      const editingTokenIds = new Set<string>();
      return {
        tokens: validationTokens,
        fields: [],
        editingTokenIds,
        isEditing: (t: ValidationToken) => editingTokenIds.has(t.id),
      };
    };

    it('only validates specified field', () => {
      const rule = createFieldRule('email', (value) => {
        if (!value.includes('@')) {
          return 'Invalid email';
        }
      });

      const emailCtx = createContext([{ key: 'email', operator: ':', value: 'invalid' }]);
      const emailResult = rule.validate(emailCtx) as Violation[];
      expect(emailResult.length).toBeGreaterThan(0);

      const otherCtx = createContext([{ key: 'name', operator: ':', value: 'invalid' }]);
      const otherResult = rule.validate(otherCtx) as Violation[];
      expect(otherResult).toEqual([]);
    });

    it('receives value, allTokens, and operator', () => {
      let receivedValue: string | undefined;
      let receivedOperator: string | undefined;
      let receivedTokenCount: number | undefined;

      const rule = createFieldRule('status', (value, allTokens, operator) => {
        receivedValue = value;
        receivedOperator = operator;
        receivedTokenCount = allTokens.length;
        return null;
      });

      const ctx = createContext([
        { key: 'status', operator: '!=', value: 'active' },
        { key: 'tag', operator: ':', value: 'foo' },
      ]);
      rule.validate(ctx);

      expect(receivedValue).toBe('active');
      expect(receivedOperator).toBe('!=');
      expect(receivedTokenCount).toBe(2);
    });

    it('uses field-based default id', () => {
      const rule = createFieldRule('email', () => null);
      expect(rule.id).toBe('field-rule-email');
    });

    it('allows custom id override', () => {
      const rule = createFieldRule('email', () => null, { id: 'email-format' });
      expect(rule.id).toBe('email-format');
    });

    it('passes through priority option', () => {
      const rule = createFieldRule('email', () => null, {
        priority: 100,
      });
      expect(rule.priority).toBe(100);
    });
  });
});
