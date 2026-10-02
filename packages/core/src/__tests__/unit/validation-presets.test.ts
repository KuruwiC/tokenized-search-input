import { describe, expect, it } from 'vitest';
import type { FieldDefinition, ValidationContext, ValidationToken, Violation } from '../../types';
import {
  createFieldRule,
  createRule,
  MaxCount,
  RequireEnum,
  RequirePattern,
  Unique,
} from '../../validation/presets';

const targetIds = (violations: Violation[], action?: Violation['action']): string[] =>
  violations
    .filter((v) => action === undefined || v.action === action)
    .flatMap((v) => v.targets.map((t) => t.tokenId));

const filterToken = (
  id: string,
  key: string,
  operator: string,
  value: string
): ValidationToken => ({
  id,
  type: 'filter',
  key,
  operator,
  value,
  rawValue: value,
});

const freeTextToken = (id: string, value: string): ValidationToken => ({
  id,
  type: 'freeText',
  key: '',
  operator: '',
  value,
  rawValue: value,
});

const contextOf = (
  tokens: ValidationToken[],
  options: {
    editing?: string[];
    focused?: string | null;
    fields?: FieldDefinition[];
  } = {}
): ValidationContext => {
  const editingTokenIds = new Set(options.editing ?? []);
  return {
    tokens,
    fields: options.fields ?? [],
    editingTokenIds,
    focusedTokenId: options.focused ?? null,
    isEditing: (t) => editingTokenIds.has(t.id),
  };
};

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
    ): ValidationContext =>
      contextOf([filterToken('test-token-1', key, ':', tokenValue)], { fields });

    const rule = RequireEnum.rule();

    describe('stored value', () => {
      it('accepts an option value', () => {
        expect(rule.validate(createContext('active'))).toEqual([]);
      });

      // Values are stored as the option value, so a label or another case is not one.
      it.each([
        'Active',
        'ACTIVE',
        'INACTIVE',
        'pending review',
        'Pending Review',
      ])('rejects %s, which is not an option value', (value) => {
        const result = rule.validate(createContext(value));
        expect(result).toHaveLength(1);
        expect(result[0].reason).toBe('invalid-enum-value');
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

      it('rejects a string value in another case', () => {
        const ctx = createContext('LOW', [stringEnumField], 'priority');
        expect(rule.validate(ctx)).toHaveLength(1);
      });

      it('rejects partial string value', () => {
        const ctx = createContext('lo', [stringEnumField], 'priority');
        const result = rule.validate(ctx) as Violation[];
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('custom options', () => {
      it('uses custom message', () => {
        const customRule = RequireEnum.rule({ message: 'Custom error message' });
        const result = customRule.validate(createContext('invalid')) as Violation[];
        expect(result[0].message).toBe('Custom error message');
      });

      it('deletes an edited token with an invalid value when rejecting', () => {
        const customRule = RequireEnum.rule({ onInvalid: 'reject' });
        const token = filterToken('editing-token', 'status', ':', 'invalid');
        const ctx = contextOf([token], { editing: ['editing-token'], fields: [enumField] });
        const result = customRule.validate(ctx);
        expect(result[0].action).toBe('delete');
      });

      it('only marks the token the user is in when rejecting', () => {
        const customRule = RequireEnum.rule({ onInvalid: 'reject' });
        const token = filterToken('editing-token', 'status', ':', 'invalid');
        const ctx = contextOf([token], {
          editing: ['editing-token'],
          focused: 'editing-token',
          fields: [enumField],
        });
        expect(customRule.validate(ctx)[0].action).toBe('mark');
      });

      it('only marks a token that was not edited when rejecting', () => {
        const customRule = RequireEnum.rule({ onInvalid: 'reject' });
        const token = filterToken('existing-token', 'status', ':', 'invalid');
        const ctx = contextOf([token], { fields: [enumField] });
        expect(customRule.validate(ctx)[0].action).toBe('mark');
      });

      it('sets custom priority', () => {
        const customRule = RequireEnum.rule({ priority: 100 });
        expect(customRule.priority).toBe(100);
      });
    });
  });

  describe('createRule', () => {
    const contextFor = (tokens: Array<{ key: string; operator: string; value: string }>) =>
      contextOf(tokens.map((t, i) => filterToken(`test-token-${i}`, t.key, t.operator, t.value)));

    const markViolation = (ruleId: string, token: ValidationToken, message: string): Violation => ({
      ruleId,
      reason: 'custom',
      message,
      action: 'mark',
      targets: [{ tokenId: token.id }],
    });

    it('returns no violations when every token passes', () => {
      const rule = createRule('valid-only', (token) =>
        token.value === 'valid' ? null : markViolation('valid-only', token, 'Invalid value')
      );

      const result = rule.validate(contextFor([{ key: 'status', operator: ':', value: 'valid' }]));
      expect(result).toEqual([]);
    });

    it('returns the violation of a token that fails', () => {
      const rule = createRule('valid-only', (token) =>
        token.value === 'valid' ? null : markViolation('valid-only', token, 'Value is invalid')
      );

      const result = rule.validate(
        contextFor([{ key: 'status', operator: ':', value: 'invalid' }])
      );
      expect(result).toEqual([
        {
          ruleId: 'valid-only',
          reason: 'custom',
          message: 'Value is invalid',
          action: 'mark',
          targets: [{ tokenId: 'test-token-0' }],
        },
      ]);
    });

    it('accepts several violations for one token', () => {
      const rule = createRule('two', (token) => [
        markViolation('two', token, 'first'),
        markViolation('two', token, 'second'),
      ]);

      const result = rule.validate(contextFor([{ key: 'status', operator: ':', value: 'x' }]));
      expect(result.map((v) => v.message)).toEqual(['first', 'second']);
    });

    it('gives the check every token and whether it is being edited', () => {
      const rule = createRule('replace-status', (token, ctx) => {
        if (token.key !== 'status' || !ctx.isEditing(token)) return null;
        const others = ctx.tokens.filter((t) => t.key === 'status' && t.id !== token.id);
        if (others.length === 0) return null;
        return {
          ruleId: 'replace-status',
          reason: 'replaced',
          action: 'delete',
          targets: others.map((t) => ({ tokenId: t.id })),
        };
      });

      const tokens = [
        filterToken('old', 'status', ':', 'old'),
        filterToken('tag', 'tag', ':', 'foo'),
        filterToken('new', 'status', ':', 'new'),
      ];
      const result = rule.validate(contextOf(tokens, { editing: ['new'] }));
      expect(targetIds(result, 'delete')).toEqual(['old']);
    });

    it('uses the given id', () => {
      expect(createRule('my-custom-rule', () => null).id).toBe('my-custom-rule');
    });

    it('sets priority option', () => {
      expect(createRule('r', () => null, { priority: 50 }).priority).toBe(50);
    });
  });

  describe('createFieldRule', () => {
    const contextFor = (tokens: Array<{ key: string; operator: string; value: string }>) =>
      contextOf(tokens.map((t, i) => filterToken(`test-token-${i}`, t.key, t.operator, t.value)));

    it('only validates specified field', () => {
      const rule = createFieldRule('email', (token) =>
        token.value.includes('@')
          ? null
          : {
              ruleId: 'field-rule-email',
              reason: 'format',
              message: 'Invalid email',
              action: 'mark',
              targets: [{ tokenId: token.id }],
            }
      );

      const emailResult = rule.validate(
        contextFor([{ key: 'email', operator: ':', value: 'invalid' }])
      );
      expect(emailResult.length).toBeGreaterThan(0);

      const otherResult = rule.validate(
        contextFor([{ key: 'name', operator: ':', value: 'invalid' }])
      );
      expect(otherResult).toEqual([]);
    });

    it('receives the token and the context', () => {
      let received: { value: string; operator: string; tokenCount: number } | undefined;

      const rule = createFieldRule('status', (token, ctx) => {
        received = { value: token.value, operator: token.operator, tokenCount: ctx.tokens.length };
        return null;
      });

      rule.validate(
        contextFor([
          { key: 'status', operator: '!=', value: 'active' },
          { key: 'tag', operator: ':', value: 'foo' },
        ])
      );

      expect(received).toEqual({ value: 'active', operator: '!=', tokenCount: 2 });
    });

    it('uses field-based default id', () => {
      expect(createFieldRule('email', () => null).id).toBe('field-rule-email');
    });

    it('allows custom id override', () => {
      expect(createFieldRule('email', () => null, { id: 'email-format' }).id).toBe('email-format');
    });

    it('passes through priority option', () => {
      expect(createFieldRule('email', () => null, { priority: 100 }).priority).toBe(100);
    });
  });
});

describe('Unique', () => {
  const freeText = [freeTextToken('a', 'one'), freeTextToken('b', 'two')];

  it('does not treat free text tokens as duplicates under the key constraint', () => {
    expect(Unique.rule('key').validate(contextOf(freeText))).toEqual([]);
  });

  it('does not treat free text tokens as duplicates under the key-operator constraint', () => {
    expect(Unique.rule('key-operator').validate(contextOf(freeText))).toEqual([]);
  });

  it('still treats free text tokens with the same value as duplicates under the exact constraint', () => {
    const same = [freeTextToken('a', 'one'), freeTextToken('b', 'one')];
    expect(targetIds(Unique.rule('exact').validate(contextOf(same)))).toEqual(['b']);
  });

  it('does not group a free text token with a filter token', () => {
    const tokens = [freeTextToken('a', ''), filterToken('b', '', 'is', '')];
    expect(Unique.rule('key').validate(contextOf(tokens))).toEqual([]);
  });

  it('puts the message on the violation', () => {
    const tokens = [filterToken('a', 'status', 'is', 'x'), filterToken('b', 'status', 'is', 'y')];
    const [violation] = Unique.rule('key').validate(contextOf(tokens));
    expect(violation).toMatchObject({
      ruleId: 'unique-key',
      reason: 'duplicate',
      message: 'Only one "status" filter is allowed',
    });
  });

  describe('onDuplicate', () => {
    const [first, second, third] = ['a', 'b', 'c'].map((id) => filterToken(id, 'status', 'is', id));

    it("'mark' marks every duplicate after the first, edited or not", () => {
      const rule = Unique.rule('key', { onDuplicate: 'mark' });
      const result = rule.validate(contextOf([first, second, third], { editing: ['c'] }));
      expect(targetIds(result, 'mark')).toEqual(['b', 'c']);
      expect(targetIds(result, 'delete')).toEqual([]);
    });

    it("'reject' deletes the edited duplicate and keeps the existing token", () => {
      const rule = Unique.rule('key', { onDuplicate: 'reject' });
      const result = rule.validate(contextOf([first, second], { editing: ['b'] }));
      expect(targetIds(result, 'delete')).toEqual(['b']);
      expect(targetIds(result, 'mark')).toEqual([]);
    });

    it("'reject' deletes the edited token even when it comes first", () => {
      const rule = Unique.rule('key', { onDuplicate: 'reject' });
      const result = rule.validate(contextOf([first, second], { editing: ['a'] }));
      expect(targetIds(result, 'delete')).toEqual(['a']);
    });

    it("'reject' keeps the first token when all of them are edited", () => {
      const rule = Unique.rule('key', { onDuplicate: 'reject' });
      const result = rule.validate(contextOf([first, second, third], { editing: ['a', 'b', 'c'] }));
      expect(targetIds(result, 'delete')).toEqual(['b', 'c']);
    });

    it("'reject' only marks when no token was edited, even if one is focused", () => {
      const rule = Unique.rule('key', { onDuplicate: 'reject' });
      const result = rule.validate(contextOf([first, second], { focused: 'a' }));
      expect(targetIds(result, 'delete')).toEqual([]);
      expect(targetIds(result, 'mark')).toEqual(['b']);
    });

    it("'reject' marks an edited duplicate while the user is in it", () => {
      const rule = Unique.rule('key', { onDuplicate: 'reject' });
      const result = rule.validate(contextOf([first, second], { editing: ['b'], focused: 'b' }));
      expect(targetIds(result, 'delete')).toEqual([]);
      expect(targetIds(result, 'mark')).toEqual(['b']);
    });

    it("'replace' deletes the others and keeps the last edited token", () => {
      const rule = Unique.rule('key', { onDuplicate: 'replace' });
      const result = rule.validate(contextOf([first, second, third], { editing: ['b'] }));
      expect(targetIds(result, 'delete')).toEqual(['a', 'c']);
    });

    it("'replace' marks the others while the user is still in the token that replaces them", () => {
      const rule = Unique.rule('key', { onDuplicate: 'replace' });
      const result = rule.validate(contextOf([first, second], { editing: ['b'], focused: 'b' }));
      expect(targetIds(result, 'delete')).toEqual([]);
      expect(targetIds(result, 'mark')).toEqual(['a']);
    });

    it("'replace' keeps the last token when all of them are edited", () => {
      const rule = Unique.rule('key', { onDuplicate: 'replace' });
      const result = rule.validate(contextOf([first, second, third], { editing: ['a', 'b', 'c'] }));
      expect(targetIds(result, 'delete')).toEqual(['a', 'b']);
    });

    it("'replace' only marks when no token was edited", () => {
      const rule = Unique.rule('key', { onDuplicate: 'replace' });
      const result = rule.validate(contextOf([first, second]));
      expect(targetIds(result, 'delete')).toEqual([]);
      expect(targetIds(result, 'mark')).toEqual(['a']);
    });
  });
});

describe('MaxCount', () => {
  const tags = ['a', 'b', 'c', 'd'].map((id) => filterToken(id, 'tag', 'is', id));

  it('does nothing within the limit', () => {
    expect(MaxCount.rule('tag', 4).validate(contextOf(tags))).toEqual([]);
  });

  it('marks the tokens past the limit', () => {
    const result = MaxCount.rule('tag', 2).validate(contextOf(tags));
    expect(targetIds(result, 'mark')).toEqual(['c', 'd']);
  });

  it('puts its message on the violation', () => {
    const [violation] = MaxCount.rule('tag', 2).validate(contextOf(tags));
    expect(violation.message).toBe('Maximum 2 "tag" filters allowed');
    const [custom] = MaxCount.rule('tag', 2, { message: 'Too many' }).validate(contextOf(tags));
    expect(custom.message).toBe('Too many');
  });

  it("deletes only edited tokens with onExceed 'reject'", () => {
    const rule = MaxCount.rule('tag', 3, { onExceed: 'reject' });
    const result = rule.validate(contextOf(tags, { editing: ['b'] }));
    expect(targetIds(result, 'delete')).toEqual(['b']);
    expect(targetIds(result, 'mark')).toEqual([]);
  });

  it("marks the last tokens when too few are edited to delete with onExceed 'reject'", () => {
    const rule = MaxCount.rule('tag', 2, { onExceed: 'reject' });
    const result = rule.validate(contextOf(tags, { editing: ['b'] }));
    expect(targetIds(result, 'delete')).toEqual(['b']);
    expect(targetIds(result, 'mark')).toEqual(['d']);
  });

  it("does not delete the token the user is in with onExceed 'reject'", () => {
    const rule = MaxCount.rule('tag', 3, { onExceed: 'reject' });
    const result = rule.validate(contextOf(tags, { editing: ['d'], focused: 'd' }));
    expect(targetIds(result, 'delete')).toEqual([]);
    expect(targetIds(result, 'mark')).toEqual(['d']);
  });
});

describe('RequirePattern', () => {
  const email = filterToken('a', 'email', 'is', 'nope');

  it('marks a value that does not match', () => {
    const result = RequirePattern.rule('email', /@/).validate(contextOf([email]));
    expect(result).toEqual([
      {
        ruleId: 'pattern-email',
        reason: 'pattern',
        message: 'Invalid format for "email"',
        action: 'mark',
        targets: [{ tokenId: 'a' }],
      },
    ]);
  });

  it("deletes an edited token with onInvalid 'reject'", () => {
    const rule = RequirePattern.rule('email', /@/, { onInvalid: 'reject', message: 'Bad' });
    const [violation] = rule.validate(contextOf([email], { editing: ['a'] }));
    expect(violation).toMatchObject({ action: 'delete', message: 'Bad' });
  });

  it("only marks a token that was not edited with onInvalid 'reject'", () => {
    const rule = RequirePattern.rule('email', /@/, { onInvalid: 'reject' });
    expect(rule.validate(contextOf([email]))[0].action).toBe('mark');
  });
});
