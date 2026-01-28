import { describe, expect, it } from 'vitest';
import {
  computeAttrsPatch,
  type TokenAttrAction,
  type TokenEditableAttrs,
  tokenAttrReducer,
} from '../../tokens/filter-token/token-attr-reducer';

describe('tokenAttrReducer', () => {
  const baseAttrs: TokenEditableAttrs = {
    value: 'test',
    operator: 'is',
    key: 'status',
    confirmed: true,
    immutable: false,
    invalid: false,
    displayValue: 'Test Display',
    startContent: null,
    endContent: null,
  };

  describe('VALUE_CHANGED action', () => {
    const testCases: Array<{
      name: string;
      current: TokenEditableAttrs;
      action: TokenAttrAction;
      expected: Partial<TokenEditableAttrs>;
    }> = [
      {
        name: 'resets confirmed and clears decoration',
        current: baseAttrs,
        action: { type: 'VALUE_CHANGED', value: 'new-value' },
        expected: {
          value: 'new-value',
          confirmed: false,
          invalid: false,
          displayValue: null,
          startContent: null,
          endContent: null,
        },
      },
      {
        name: 'preserves other attributes',
        current: { ...baseAttrs, immutable: true },
        action: { type: 'VALUE_CHANGED', value: 'updated' },
        expected: {
          value: 'updated',
          immutable: true,
          operator: 'is',
          key: 'status',
        },
      },
    ];

    testCases.forEach(({ name, current, action, expected }) => {
      it(name, () => {
        const result = tokenAttrReducer(current, action);
        expect(result).toMatchObject(expected);
      });
    });
  });

  describe('OPERATOR_CHANGED action', () => {
    const testCases: Array<{
      name: string;
      current: TokenEditableAttrs;
      action: TokenAttrAction;
      expected: Partial<TokenEditableAttrs>;
    }> = [
      {
        name: 'resets confirmed only',
        current: baseAttrs,
        action: { type: 'OPERATOR_CHANGED', operator: 'not' },
        expected: {
          operator: 'not',
          confirmed: false,
        },
      },
      {
        name: 'preserves displayValue and other attributes',
        current: baseAttrs,
        action: { type: 'OPERATOR_CHANGED', operator: 'contains' },
        expected: {
          operator: 'contains',
          confirmed: false,
          displayValue: 'Test Display',
          value: 'test',
        },
      },
    ];

    testCases.forEach(({ name, current, action, expected }) => {
      it(name, () => {
        const result = tokenAttrReducer(current, action);
        expect(result).toMatchObject(expected);
      });
    });
  });

  describe('FIELD_CHANGED action', () => {
    const testCases: Array<{
      name: string;
      current: TokenEditableAttrs;
      action: TokenAttrAction;
      expected: Partial<TokenEditableAttrs>;
    }> = [
      {
        name: 'resets confirmed, immutable, and decoration',
        current: { ...baseAttrs, immutable: true },
        action: { type: 'FIELD_CHANGED', key: 'priority', operator: 'is' },
        expected: {
          key: 'priority',
          operator: 'is',
          confirmed: false,
          immutable: false,
          displayValue: null,
          startContent: null,
          endContent: null,
        },
      },
      {
        name: 'preserves value when field changes',
        current: baseAttrs,
        action: { type: 'FIELD_CHANGED', key: 'category', operator: 'equals' },
        expected: {
          key: 'category',
          operator: 'equals',
          value: 'test',
        },
      },
    ];

    testCases.forEach(({ name, current, action, expected }) => {
      it(name, () => {
        const result = tokenAttrReducer(current, action);
        expect(result).toMatchObject(expected);
      });
    });
  });

  describe('CONFIRM action', () => {
    it('sets confirmed to true while preserving other attributes', () => {
      const current = { ...baseAttrs, confirmed: false };
      const result = tokenAttrReducer(current, { type: 'CONFIRM' });
      expect(result.confirmed).toBe(true);
      expect(result.value).toBe(current.value);
      expect(result.displayValue).toBe(current.displayValue);
      expect(result.operator).toBe(current.operator);
    });
  });

  describe('MARK_IMMUTABLE action', () => {
    it('sets both confirmed and immutable to true', () => {
      const current = { ...baseAttrs, confirmed: false, immutable: false };
      const result = tokenAttrReducer(current, { type: 'MARK_IMMUTABLE' });
      expect(result.confirmed).toBe(true);
      expect(result.immutable).toBe(true);
    });
  });

  describe('RESET_DECORATION action', () => {
    it('clears displayValue, startContent, and endContent', () => {
      const current = {
        ...baseAttrs,
        displayValue: 'Custom Display',
        startContent: 'Icon',
        endContent: 'Suffix',
      };
      const result = tokenAttrReducer(current, { type: 'RESET_DECORATION' });
      expect(result.displayValue).toBeNull();
      expect(result.startContent).toBeNull();
      expect(result.endContent).toBeNull();
    });

    it('preserves confirmed and other attributes', () => {
      const current = { ...baseAttrs, displayValue: 'Custom' };
      const result = tokenAttrReducer(current, { type: 'RESET_DECORATION' });
      expect(result.confirmed).toBe(true);
      expect(result.value).toBe('test');
    });
  });

  describe('action composition', () => {
    it('allows chaining CONFIRM then MARK_IMMUTABLE', () => {
      const current = { ...baseAttrs, confirmed: false, immutable: false };
      const afterConfirm = tokenAttrReducer(current, { type: 'CONFIRM' });
      const afterImmutable = tokenAttrReducer(afterConfirm, { type: 'MARK_IMMUTABLE' });

      expect(afterImmutable.confirmed).toBe(true);
      expect(afterImmutable.immutable).toBe(true);
    });

    it('VALUE_CHANGED after CONFIRM resets confirmed', () => {
      const current = { ...baseAttrs, confirmed: true };
      const afterValue = tokenAttrReducer(current, { type: 'VALUE_CHANGED', value: 'edited' });

      expect(afterValue.confirmed).toBe(false);
      expect(afterValue.value).toBe('edited');
    });
  });
});

describe('computeAttrsPatch', () => {
  const baseAttrs: TokenEditableAttrs = {
    value: 'test',
    operator: 'is',
    key: 'status',
    confirmed: true,
    immutable: false,
    invalid: false,
    displayValue: 'Display',
    startContent: null,
    endContent: null,
  };

  it('returns empty object when no changes', () => {
    const patch = computeAttrsPatch(baseAttrs, baseAttrs);
    expect(patch).toEqual({});
  });

  it('returns only changed fields', () => {
    const next = { ...baseAttrs, value: 'new-value', confirmed: false };
    const patch = computeAttrsPatch(baseAttrs, next);
    expect(patch).toEqual({ value: 'new-value', confirmed: false });
  });

  it('includes null values when they change', () => {
    const next = { ...baseAttrs, displayValue: null };
    const patch = computeAttrsPatch(baseAttrs, next);
    expect(patch).toEqual({ displayValue: null });
  });
});
