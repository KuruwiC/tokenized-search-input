/**
 * Integration tests for the validation system.
 * Tests validation rules, duplicate detection, and constraint behaviors.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useEffect, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { getSuggestionState, type SuggestionType } from '../../plugins/suggestion';
import type { FieldDefinition, ValidationRule } from '../../types';
import { MaxCount, RequirePattern, Unique } from '../../validation/presets';
import { fieldsWithValidationOverride } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

const testFields = fieldsWithValidationOverride;

/**
 * Helper to verify token counts in the DOM.
 * Consolidates the repeated waitFor + querySelectorAll pattern.
 */
async function expectTokenCounts(total: number, invalid: number): Promise<void> {
  await waitFor(() => {
    const tokens = document.querySelectorAll('.node-filterToken');
    expect(tokens.length).toBe(total);
  });
  await waitFor(() => {
    const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
    expect(invalidTokens.length).toBe(invalid);
  });
}

afterEach(() => {
  cleanup();
});

describe('Validation System Integration', () => {
  describe('No validation (default)', () => {
    it('allows duplicates when no validation is configured', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
        />
      );

      await expectTokenCounts(2, 0);
    });
  });

  describe('Unique key constraint', () => {
    it('marks duplicate keys as invalid', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key')] }}
        />
      );

      await expectTokenCounts(2, 1);
    });

    it('respects field-level override to disable rule', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="tag:is:bug tag:is:feature"
          validation={{ rules: [Unique.rule('key')] }}
        />
      );

      // tag field has unique-key: false, so no duplicates detected
      await expectTokenCounts(2, 0);
    });
  });

  describe('Unique key-operator constraint', () => {
    it('allows same key with different operators', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is_not:inactive"
          validation={{ rules: [Unique.rule('key-operator')] }}
        />
      );

      // Different operators, so not duplicates
      await expectTokenCounts(2, 0);
    });

    it('detects duplicates with same key and operator', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key-operator')] }}
        />
      );

      // Same key and operator (different values), so second is duplicate
      await expectTokenCounts(2, 1);
    });
  });

  describe('Unique exact constraint', () => {
    it('allows same key with different values', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('exact')] }}
        />
      );

      // Different values, so not duplicates
      await expectTokenCounts(2, 0);
    });

    it('detects exact duplicates', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:active"
          validation={{ rules: [Unique.rule('exact')] }}
        />
      );

      await expectTokenCounts(2, 1);
    });
  });

  describe('Unique with onDuplicate', () => {
    it('marks the duplicate with onDuplicate mark', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'mark' })] }}
        />
      );

      await expectTokenCounts(2, 1);
    });

    it("deletes the later duplicates with onDuplicate 'reject' on the initial content", async () => {
      // The initial content counts as edited in every token, so
      // onDuplicate 'reject' keeps the first occurrence and deletes the later ones
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
        />
      );

      // Only first token remains (later duplicate deleted)
      await expectTokenCounts(1, 0);

      // The remaining token should be the first one (active)
      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('active');
      });
    });
  });

  describe('Rule priority', () => {
    it('runs higher priority rules first', async () => {
      // All rules run and their violations are collected.
      const executionOrder: string[] = [];

      const highPriorityRule: ValidationRule = {
        id: 'high-priority-rule',
        validate: (ctx) => {
          executionOrder.push('high');
          const statusTokens = ctx.tokens.filter((t) => t.key === 'status');
          if (statusTokens.length <= 1) return [];

          return [
            {
              ruleId: 'high-priority-rule',
              reason: 'duplicate',
              action: 'mark' as const,
              targets: statusTokens.slice(1).map((t) => ({ tokenId: t.id })),
            },
          ];
        },
        priority: 100,
      };

      const lowPriorityRule: ValidationRule = {
        id: 'low-priority-rule',
        validate: () => {
          executionOrder.push('low');
          // Returns empty - just to verify execution order
          return [];
        },
        priority: 10,
      };

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [lowPriorityRule, highPriorityRule] }}
        />
      );

      await expectTokenCounts(2, 1);

      // Verify high priority rule ran first
      await waitFor(() => {
        expect(executionOrder[0]).toBe('high');
        expect(executionOrder[1]).toBe('low');
      });
    });
  });

  describe('Multiple rules with different actions', () => {
    it('applies different actions per rule', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:active priority:is:high priority:is:low"
          validation={{
            rules: [
              Unique.rule('exact', { onDuplicate: 'reject' }),
              Unique.rule('key', { onDuplicate: 'mark' }),
            ],
          }}
        />
      );

      // status:is:active duplicate should be deleted (exact match)
      // priority:is:low should be marked (same key, different value)
      await expectTokenCounts(3, 1);
    });
  });

  describe('Custom validation rules', () => {
    it('supports custom validation logic', async () => {
      const maxTwoStatus: ValidationRule = {
        id: 'max-two-status',
        validate: (ctx) => {
          const statusTokens = ctx.tokens.filter((t) => t.key === 'status');

          if (statusTokens.length <= 2) return [];

          // Mark tokens beyond the first 2
          return [
            {
              ruleId: 'max-two-status',
              reason: 'max-exceeded',
              message: 'Maximum 2 status filters allowed',
              action: 'mark' as const,
              targets: statusTokens.slice(2).map((t) => ({ tokenId: t.id })),
            },
          ];
        },
      };

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive status:is:pending"
          validation={{ rules: [maxTwoStatus] }}
        />
      );

      // Third status is invalid
      await expectTokenCounts(3, 1);
    });
  });

  describe('setValue with validation', () => {
    it('validates tokens when setValue is called', async () => {
      const editorRefHolder: { current: TokenizedSearchInputRef | null } = { current: null };

      function TestComponent() {
        const ref = useRef<TokenizedSearchInputRef>(null);

        useEffect(() => {
          if (ref.current) {
            editorRefHolder.current = ref.current;
          }
        }, []);

        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            defaultValue=""
            validation={{ rules: [Unique.rule('key')] }}
          />
        );
      }

      render(<TestComponent />);

      await waitFor(() => {
        expect(editorRefHolder.current).not.toBeNull();
      });

      editorRefHolder.current?.setValue('status:is:active status:is:inactive');

      await expectTokenCounts(2, 1);
    });

    it('deletes duplicates on setValue', async () => {
      const editorRefHolder: { current: TokenizedSearchInputRef | null } = { current: null };

      function TestComponent() {
        const ref = useRef<TokenizedSearchInputRef>(null);

        useEffect(() => {
          if (ref.current) {
            editorRefHolder.current = ref.current;
          }
        }, []);

        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            defaultValue=""
            validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
          />
        );
      }

      render(<TestComponent />);

      await waitFor(() => {
        expect(editorRefHolder.current).not.toBeNull();
      });

      editorRefHolder.current?.setValue('status:is:active status:is:inactive priority:is:high');

      // status + priority (duplicate status deleted)
      await expectTokenCounts(2, 0);
    });
  });

  describe('Unique with onDuplicate replace', () => {
    it("deletes the earlier token and keeps the later one with onDuplicate 'replace'", async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // With onDuplicate 'replace', the later token (status:inactive) should survive
      // and the earlier token (status:active) should be deleted
      await expectTokenCounts(1, 0);

      // The remaining token should be the later one (inactive)
      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('inactive');
      });
    });

    it("does not delete a token that is still being entered with onDuplicate 'replace'", async () => {
      // A token with an empty value is still being entered and is not deleted
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      await expectTokenCounts(1, 0);
    });
  });

  describe('Editing token protection', () => {
    it('marks editing tokens as invalid but does not delete them', async () => {
      // Tokens with empty value should be marked but not deleted
      const fieldsWithOverride: FieldDefinition[] = [
        {
          key: 'status',
          label: 'Status',
          type: 'enum',
          operators: ['is'],
          enumValues: ['active', 'inactive'],
        },
      ];

      render(
        <TokenizedSearchInput
          fields={fieldsWithOverride}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
        />
      );

      await expectTokenCounts(1, 0);
    });
  });

  describe('onDuplicate replace with 3+ duplicates', () => {
    it('deletes all earlier tokens and keeps only the latest one', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive status:is:pending"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // With onDuplicate 'replace', only the latest token (status:pending) should survive
      await expectTokenCounts(1, 0);

      // The remaining token should be the latest one (pending)
      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('pending');
      });
    });
  });

  describe('maxCount preset', () => {
    it('marks tokens exceeding count limit', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive status:is:pending"
          validation={{ rules: [MaxCount.rule('status', 2)] }}
        />
      );

      // Third token should be invalid (exceeds max 2)
      await expectTokenCounts(3, 1);
    });

    it('respects wildcard * for total count', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active priority:is:high tag:is:bug"
          validation={{ rules: [MaxCount.rule('*', 2)] }}
        />
      );

      // Third token should be invalid (exceeds max 2 total)
      await expectTokenCounts(3, 1);
    });
  });

  describe('pattern preset', () => {
    it('validates value against regex', async () => {
      const fieldsWithPattern: FieldDefinition[] = [
        {
          key: 'email',
          label: 'Email',
          type: 'string',
          operators: ['is'],
        },
      ];

      render(
        <TokenizedSearchInput
          fields={fieldsWithPattern}
          defaultValue="email:is:invalid"
          validation={{ rules: [RequirePattern.rule('email', /^[^@]+@[^@]+\.[^@]+$/)] }}
        />
      );

      // Token should be invalid (doesn't match email pattern)
      await expectTokenCounts(1, 1);
    });

    it('allows valid values', async () => {
      const fieldsWithPattern: FieldDefinition[] = [
        {
          key: 'email',
          label: 'Email',
          type: 'string',
          operators: ['is'],
        },
      ];

      render(
        <TokenizedSearchInput
          fields={fieldsWithPattern}
          defaultValue="email:is:test@example.com"
          validation={{ rules: [RequirePattern.rule('email', /^[^@]+@[^@]+\.[^@]+$/)] }}
        />
      );

      await expectTokenCounts(1, 0);
    });

    it('rejects invalid string values with custom pattern rule', async () => {
      // Test that custom pattern rule marks invalid values
      const customRule: ValidationRule = {
        id: 'string-pattern',
        validate: (ctx) => {
          const violations: {
            ruleId: string;
            reason: string;
            message: string;
            action: 'mark' | 'delete';
            targets: { tokenId: string }[];
          }[] = [];
          const validPattern = /^[a-z]+$/;

          for (const token of ctx.tokens) {
            if (token.key !== 'tags') continue;
            if (!validPattern.test(token.value)) {
              violations.push({
                ruleId: 'string-pattern',
                reason: 'pattern',
                message: 'Tag must be lowercase letters only',
                action: 'mark',
                targets: [{ tokenId: token.id }],
              });
            }
          }
          return violations;
        },
      };

      const fieldsWithTags: FieldDefinition[] = [
        {
          key: 'tags',
          label: 'Tags',
          type: 'string',
          operators: ['is'],
        },
      ];

      render(
        <TokenizedSearchInput
          fields={fieldsWithTags}
          defaultValue="tags:is:InvalidTag"
          validation={{ rules: [customRule] }}
        />
      );

      // InvalidTag contains uppercase, should be invalid
      await expectTokenCounts(1, 1);
    });
  });

  describe('Edge cases', () => {
    it('handles maxCount with max=0', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [MaxCount.rule('status', 0)] }}
        />
      );

      // Token should be invalid (max is 0)
      await expectTokenCounts(1, 1);
    });

    it('handles maxCount with max=1 (similar to unique)', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [MaxCount.rule('status', 1)] }}
        />
      );

      // Second token should be invalid
      await expectTokenCounts(2, 1);
    });

    it('handles rule that throws exception gracefully', async () => {
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const throwingRule: ValidationRule = {
        id: 'throws',
        validate: () => {
          throw new Error('Unexpected error');
        },
      };

      try {
        // Should not crash - render without crashing
        render(
          <TokenizedSearchInput
            fields={testFields}
            defaultValue="status:is:active"
            validation={{ rules: [throwingRule] }}
          />
        );

        // No invalid tokens since the rule threw
        await expectTokenCounts(1, 0);
        expect(warning).toHaveBeenCalledWith(
          'Validation rule "throws" threw an error and was skipped:',
          expect.any(Error)
        );
      } finally {
        warning.mockRestore();
      }
    });

    it("clears invalid state when the remaining token is no longer a duplicate after onDuplicate 'replace'", async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // After 'replace', only the last token remains and should be valid
      await expectTokenCounts(1, 0);
    });

    it('handles global regex correctly with multiple validations', async () => {
      const fieldsWithPattern: FieldDefinition[] = [
        {
          key: 'code',
          label: 'Code',
          type: 'string',
          operators: ['is'],
        },
      ];

      // Global regex can have stateful lastIndex issues
      render(
        <TokenizedSearchInput
          fields={fieldsWithPattern}
          defaultValue="code:is:ABC123 code:is:DEF456"
          validation={{ rules: [RequirePattern.rule('code', /^[A-Z]{3}\d{3}$/g)] }}
        />
      );

      // Both should be valid (pattern matches both)
      await expectTokenCounts(2, 0);
    });

    it('handles empty rules array', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [] }}
        />
      );

      // No validation, no invalid tokens
      await expectTokenCounts(2, 0);
    });

    it('handles adjacent token deletions correctly', async () => {
      // Test that deleting adjacent tokens doesn't cause issues with overlapping ranges
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive status:is:pending status:is:active"
          validation={{
            rules: [Unique.rule('key', { onDuplicate: 'reject' })],
          }}
        />
      );

      // Only first status should remain after all deletions
      await expectTokenCounts(1, 0);
    });

    it('Unique marks duplicates by default (onDuplicate mark)', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{
            rules: [Unique.rule('key')],
          }}
        />
      );

      // With the default onDuplicate 'mark', duplicates are marked but not deleted
      await expectTokenCounts(2, 1);
    });

    it('handles negative maxCount by treating as 0', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [MaxCount.rule('status', -1)] }}
        />
      );

      // Negative max should be treated as 0, so token is invalid
      await expectTokenCounts(1, 1);
    });
  });

  describe('Unique violations', () => {
    it('unique rule returns violations with targets for duplicates', async () => {
      // Unique.rule() returns Violation[] with explicit targets: every duplicate except the survivor
      const capturedViolations: Array<{ ruleId: string; targetCount: number }> = [];

      const captureRule: ValidationRule = {
        id: 'capture-violations',
        validate: (ctx) => {
          const uniqueRule = Unique.rule('key');
          const result = uniqueRule.validate(ctx);

          if (Array.isArray(result)) {
            for (const violation of result) {
              capturedViolations.push({
                ruleId: violation.ruleId,
                targetCount: violation.targets.length,
              });
            }
          }

          return result;
        },
      };

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive status:is:pending"
          validation={{ rules: [captureRule] }}
        />
      );

      await expectTokenCounts(3, 2);

      // All 3 tokens share the same key, unique returns 1 violation with 2 targets (first token survives)
      expect(capturedViolations.length).toBe(1);
      expect(capturedViolations[0].ruleId).toBe('unique-key');
      expect(capturedViolations[0].targetCount).toBe(2);
    });
  });

  // onDuplicate 'reject' and 'replace' decide by which tokens were edited, not by
  // where the edited token sits relative to the others.

  describe('onDuplicate reject: position-independent behavior', () => {
    it("onDuplicate 'reject' keeps the first token on setValue", async () => {
      // setValue makes every token edited, so 'reject' deletes the later duplicates
      const TestComponent = () => {
        const ref = useRef<TokenizedSearchInputRef>(null);
        useEffect(() => {
          // Set value with duplicates
          setTimeout(() => {
            ref.current?.setValue('status:is:active status:is:inactive');
          }, 100);
        }, []);
        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
          />
        );
      };

      render(<TestComponent />);

      // After setValue with onDuplicate 'reject', the later duplicate should be deleted
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 500 }
      );

      // The remaining token should be the first one (active)
      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('active');
      });
    });
  });

  describe('onDuplicate replace: position-independent behavior', () => {
    it("onDuplicate 'replace' keeps the last token on setValue", async () => {
      // setValue makes every token edited, so 'replace' deletes the earlier duplicates
      const TestComponent = () => {
        const ref = useRef<TokenizedSearchInputRef>(null);
        useEffect(() => {
          // Set value with duplicates
          setTimeout(() => {
            ref.current?.setValue('status:is:active status:is:inactive');
          }, 100);
        }, []);
        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
          />
        );
      };

      render(<TestComponent />);

      // After setValue with onDuplicate 'replace', the earlier duplicate should be deleted
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 500 }
      );

      // The remaining token should be the last one (inactive)
      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('inactive');
      });
    });

    it("onDuplicate 'replace' with 3 duplicates keeps only the last token on setValue", async () => {
      const TestComponent = () => {
        const ref = useRef<TokenizedSearchInputRef>(null);
        useEffect(() => {
          setTimeout(() => {
            ref.current?.setValue('status:is:first status:is:second status:is:third');
          }, 100);
        }, []);
        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
          />
        );
      };

      render(<TestComponent />);

      // After setValue with onDuplicate 'replace', only the last token should remain
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 500 }
      );

      // The remaining token should be the last one (third)
      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('third');
      });
    });
  });

  describe('onDuplicate on setValue: the surviving token follows document order', () => {
    // setValue replaces the content, so every token counts as edited and the tokens'
    // order in the document alone decides which one survives: 'reject' keeps the first
    // and 'replace' keeps the last.

    it("onDuplicate 'reject' keeps the first token on setValue", async () => {
      // Both tokens are set at once, so both count as edited.
      // onDuplicate 'reject' deletes the later one (the second token) and the first
      // token remains.
      const TestComponent = () => {
        const ref = useRef<TokenizedSearchInputRef>(null);
        useEffect(() => {
          setTimeout(() => {
            // The second token is the later duplicate
            ref.current?.setValue('status:is:first status:is:second');
          }, 100);
        }, []);
        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
          />
        );
      };

      render(<TestComponent />);

      // 'reject' preserves the first occurrence
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 500 }
      );

      // The remaining token should be "first" (the first position)
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('first');
    });

    it("onDuplicate 'replace' keeps the last token on setValue", async () => {
      // Both tokens are set at once, so both count as edited.
      // onDuplicate 'replace' deletes the earlier one (the first token) and the last
      // token remains.
      const TestComponent = () => {
        const ref = useRef<TokenizedSearchInputRef>(null);
        useEffect(() => {
          setTimeout(() => {
            ref.current?.setValue('status:is:first status:is:second');
          }, 100);
        }, []);
        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
          />
        );
      };

      render(<TestComponent />);

      // 'replace' preserves the last occurrence
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 500 }
      );

      // The remaining token should be "second" (the last position)
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('second');
    });

    it("onDuplicate 'reject' with 3 duplicates keeps only the first token on setValue", async () => {
      const TestComponent = () => {
        const ref = useRef<TokenizedSearchInputRef>(null);
        useEffect(() => {
          setTimeout(() => {
            ref.current?.setValue('status:is:first status:is:second status:is:third');
          }, 100);
        }, []);
        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
          />
        );
      };

      render(<TestComponent />);

      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 500 }
      );

      // Only first token remains
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('first');
    });

    it("onDuplicate 'reject' marks a duplicate added through the suggestion list while it is focused", async () => {
      const user = userEvent.setup();

      // Start with existing token
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
        />
      );

      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });

      // Click to focus the editor (after the token)
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);

      // Wait for suggestions
      await waitFor(() => {
        const listbox = document.querySelector('[role="listbox"]');
        expect(listbox).toBeTruthy();
      });

      // Find and click the Status option to create a duplicate
      const statusOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
        el.textContent?.includes('Status')
      ) as HTMLElement;

      if (statusOption) {
        await user.click(statusOption);

        // Should now have 2 tokens (existing + new editing)
        await waitFor(
          () => {
            const tokens = document.querySelectorAll('.node-filterToken');
            expect(tokens.length).toBe(2);
          },
          { timeout: 1000 }
        );

        // The new token is marked while the user is in it ('reject' deletes it only after they leave)
        await waitFor(() => {
          const invalidTokens = document.querySelectorAll('[data-invalid="true"]');
          expect(invalidTokens.length).toBeGreaterThanOrEqual(1);
        });
      }
    });

    it("onDuplicate 'reject' keeps the first occurrence in document order on setValue", async () => {
      // setValue makes every token edited, so document order decides:
      // the first occurrence is preserved. This differs from the interactive case,
      // where the token edited in the focus session is the one deleted.
      const TestComponent = () => {
        const ref = useRef<TokenizedSearchInputRef>(null);
        useEffect(() => {
          setTimeout(() => {
            // Document order: [inactive] [active]; the first occurrence (inactive) is preserved
            ref.current?.setValue('status:is:inactive status:is:active');
          }, 100);
        }, []);
        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
          />
        );
      };

      render(<TestComponent />);

      // 'reject' preserves the first occurrence
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 500 }
      );

      // First occurrence (inactive) should be preserved
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('inactive');
    });
  });

  describe('onDuplicate mark and replace on the initial content', () => {
    it("onDuplicate 'mark' marks the later duplicate without deleting it", async () => {
      // 'mark' shows the invalid state without deleting
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key')] }}
        />
      );

      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(2);
      });

      // With 'mark' action, the later duplicate should be marked invalid
      await waitFor(() => {
        const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
        expect(invalidTokens.length).toBe(1);
      });

      // The invalid token should be the later one (inactive)
      const invalidToken = document.querySelector('.node-filterToken [data-invalid="true"]');
      const tokenContent = invalidToken?.closest('.node-filterToken')?.textContent;
      expect(tokenContent).toContain('inactive');
    });

    it("onDuplicate 'replace' keeps only the last token of the initial content, unmarked", async () => {
      // The initial content counts as edited in every token, so 'replace' deletes the earlier duplicate
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Only the last token should remain
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });

      // The remaining token should be the last one (inactive)
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('inactive');

      // The remaining token should NOT be marked invalid (no more duplicates)
      const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
      expect(invalidTokens.length).toBe(0);
    });
  });

  describe("onDuplicate 'mark': marks stay the same across blur", () => {
    it('keeps the marked token the same before and after blur', async () => {
      // The unique rule marks only the later (non-first) token as invalid.
      // This marking persists through blur.
      const user = userEvent.setup();

      const TestComponent = () => {
        const ref = useRef<TokenizedSearchInputRef>(null);
        useEffect(() => {
          setTimeout(() => {
            ref.current?.setValue('priority:is:medium priority:is:high');
          }, 100);
        }, []);
        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            validation={{ rules: [Unique.rule('key', { onDuplicate: 'mark' })] }}
          />
        );
      };

      render(<TestComponent />);

      // Wait for setValue - should have 2 tokens, 1 marked (the second one)
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(2);
        },
        { timeout: 500 }
      );

      // Initial state: only the second (later) token should be marked
      await waitFor(() => {
        const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
        expect(invalidTokens.length).toBe(1);
      });

      const tokens = document.querySelectorAll('.node-filterToken');
      const firstToken = tokens[0];
      await user.click(firstToken);

      // Wait for focus to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);
      await user.keyboard('{Escape}');

      // Wait a bit for blur to settle
      await new Promise((resolve) => setTimeout(resolve, 200));

      // After blur, marking should remain consistent (1 token marked)
      await waitFor(
        () => {
          const invalidTokens = document.querySelectorAll(
            '.node-filterToken [data-invalid="true"]'
          );
          expect(invalidTokens.length).toBe(1);
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Validation with plaintext', () => {
    it('marks the existing duplicate instead of deleting it when plaintext sits between tokens (onDuplicate replace)', async () => {
      // Initial state: `status:is:active "search term" priority:is:high`
      // Action: Add a new `status:` token via suggestion
      // Expected: existing `status:is:active` is marked but not deleted immediately
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue='status:is:active "search term" priority:is:high'
          freeTextMode="plain"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Wait for initial render - should have 2 tokens + plaintext
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(2);
      });

      // Click to focus the editor
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);

      // Wait for field suggestions
      await waitFor(() => {
        const listbox = document.querySelector('[role="listbox"]');
        expect(listbox).toBeTruthy();
      });

      // Find and click the Status option to create a duplicate
      const statusOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
        el.textContent?.includes('Status')
      ) as HTMLElement;

      expect(statusOption).toBeTruthy();
      if (!statusOption) throw new Error('Status option not found');
      await user.click(statusOption);

      // Should now have 3 tokens (2 existing + 1 new editing)
      // 2 tokens here would mean the existing status:is:active was deleted immediately
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(3);
        },
        { timeout: 1000 }
      );

      // The existing status token should be MARKED as invalid, NOT deleted
      await waitFor(() => {
        const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
        expect(invalidTokens.length).toBe(1);
      });
    });

    it('should not delete immediately when adding duplicate via suggestion (onDuplicate replace)', async () => {
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Wait for initial render
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });

      // Click to focus the editor
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);

      // Wait for suggestions
      await waitFor(() => {
        const listbox = document.querySelector('[role="listbox"]');
        expect(listbox).toBeTruthy();
      });

      // Find and click the Status option to create a duplicate
      const statusOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
        el.textContent?.includes('Status')
      ) as HTMLElement;

      expect(statusOption).toBeTruthy();
      if (!statusOption) throw new Error('Status option not found');
      await user.click(statusOption);

      // Should now have 2 tokens (existing + new editing)
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(2);
        },
        { timeout: 1000 }
      );

      // The existing token should be marked as invalid ('replace' marks it while the user is in the new token)
      // This should NOT be deleted immediately - only marked
      await waitFor(() => {
        const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
        expect(invalidTokens.length).toBe(1);
      });
    });

    it("deletes the existing token only on blur when adding a duplicate via suggestion (onDuplicate 'replace')", async () => {
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Wait for initial render
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });

      // Click to focus the editor (after the token)
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);

      // Wait for suggestions
      await waitFor(() => {
        const listbox = document.querySelector('[role="listbox"]');
        expect(listbox).toBeTruthy();
      });

      // Find and click the Status option to create a duplicate
      const statusOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
        el.textContent?.includes('Status')
      ) as HTMLElement;

      expect(statusOption).toBeTruthy();
      if (!statusOption) throw new Error('Status option not found');
      await user.click(statusOption);

      // Should now have 2 tokens (existing + new editing)
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(2);
        },
        { timeout: 1000 }
      );

      // The existing token should be marked invalid ('replace' marks it while the user is in the new token)
      await waitFor(() => {
        const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
        expect(invalidTokens.length).toBe(1);
      });

      // Select a value from enum suggestions (since status is an enum field)
      // Wait for the value suggestions to appear
      await waitFor(() => {
        const options = document.querySelectorAll('[role="option"]');
        expect(options.length).toBeGreaterThan(0);
      });

      // Click the first option (e.g., "active" or another status value)
      const valueOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
        el.textContent?.includes('inactive')
      ) as HTMLElement;

      if (valueOption) {
        await user.click(valueOption);
      }

      // Click outside to blur (on the container)
      const container = document.querySelector('.tsi-container') as HTMLElement;
      if (container) {
        await user.click(container);
      }

      // After blur, the existing token should be deleted
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 2000 }
      );

      // The remaining token should be the new one (inactive)
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('inactive');
    });

    it("deletes the existing token on value selection (onDuplicate 'replace', leaving the token)", async () => {
      // Value selection leaves the token (exitTokenRight), which runs onDuplicate 'replace'
      // This is EXPECTED behavior: selecting a value completes the edit and triggers deletion
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Wait for initial render - 1 token
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });

      // Click to focus the editor
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);

      // Wait for field suggestions
      await waitFor(() => {
        const listbox = document.querySelector('[role="listbox"]');
        expect(listbox).toBeTruthy();
      });

      // Find and click Status to add duplicate
      const statusOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
        el.textContent?.includes('Status')
      ) as HTMLElement;
      expect(statusOption).toBeTruthy();
      if (!statusOption) throw new Error('Status option not found');
      await user.click(statusOption);

      // Now have 2 tokens: existing + new (editing)
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(2);
      });

      // Existing token should be marked invalid
      await waitFor(() => {
        const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
        expect(invalidTokens.length).toBe(1);
      });

      // Wait for value suggestions to appear
      await waitFor(() => {
        const options = document.querySelectorAll('[role="option"]');
        expect(options.length).toBeGreaterThan(0);
      });

      // Select 'inactive' - this triggers blur and should delete the existing token
      const valueOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
        el.textContent?.includes('inactive')
      ) as HTMLElement;
      expect(valueOption).toBeTruthy();
      if (!valueOption) throw new Error('Value option not found');
      await user.click(valueOption);

      // After selecting value, existing token should be deleted (leaving the token runs 'replace')
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 1000 }
      );

      // The remaining token should be the new one
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('inactive');
    });

    it('maintains space when multiple tokens are deleted simultaneously', async () => {
      // This tests the case where onDuplicate 'replace' removes multiple tokens at once
      // (e.g., pasting a string that violates multiple validation rules)
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="hello status:is:active priority:is:high world"
          freeTextMode="plain"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Wait for initial render - should have 2 tokens + text
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(2);
      });

      // Click to focus the editor
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);

      // Wait for field suggestions
      await waitFor(() => {
        const listbox = document.querySelector('[role="listbox"]');
        expect(listbox).toBeTruthy();
      });

      // Add duplicate status token (leaving it deletes the first status)
      const statusOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
        el.textContent?.includes('Status')
      ) as HTMLElement;
      if (!statusOption) throw new Error('Status option not found');
      await user.click(statusOption);

      // Wait for value suggestions and select one
      await waitFor(() => {
        const options = document.querySelectorAll('[role="option"]');
        expect(options.length).toBeGreaterThan(0);
      });

      const inactiveOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
        el.textContent?.includes('inactive')
      ) as HTMLElement;
      if (inactiveOption) {
        await user.click(inactiveOption);
      }

      // Now add duplicate priority token (leaving it deletes the first priority)
      await waitFor(() => {
        const listbox = document.querySelector('[role="listbox"]');
        expect(listbox).toBeTruthy();
      });

      const priorityOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
        el.textContent?.includes('Priority')
      ) as HTMLElement;
      if (priorityOption) {
        await user.click(priorityOption);

        // Wait for value suggestions and select one
        await waitFor(() => {
          const options = document.querySelectorAll('[role="option"]');
          expect(options.length).toBeGreaterThan(0);
        });

        const lowOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
          el.textContent?.includes('low')
        ) as HTMLElement;
        if (lowOption) {
          await user.click(lowOption);
        }
      }

      // Verify the serialized value maintains proper spacing
      await waitFor(
        () => {
          const value = ref.current?.getValue();
          // Text nodes should be separated by spaces, not concatenated
          // The tokens may be at the start or end depending on where they were added
          expect(value).toContain('hello');
          expect(value).toContain('world');
          expect(value).not.toContain('helloworld');
          // Verify proper space between hello and world
          expect(value).toMatch(/hello\s+world/);
        },
        { timeout: 2000 }
      );
    });
  });

  describe('duplicates among pasted tokens', () => {
    it("onDuplicate 'reject' keeps the first occurrence of each duplicate on paste", async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          validation={{ rules: [Unique.rule('exact', { onDuplicate: 'reject' })] }}
        />
      );

      // Paste: tag:is:aaa tag:is:bbb tag:is:ccc tag:is:ddd tag:is:aaa tag:is:ddd tag:is:bbb tag:is:aaa
      // Expected: aaa, bbb, ccc, ddd (first occurrence of each)
      await act(async () => {
        ref.current?.setValue(
          'tag:is:aaa tag:is:bbb tag:is:ccc tag:is:ddd tag:is:aaa tag:is:ddd tag:is:bbb tag:is:aaa'
        );
      });

      const tokens = document.querySelectorAll('.node-filterToken');
      expect(tokens.length).toBe(4);

      const tokenTexts = Array.from(tokens).map((el) => el.textContent);
      expect(tokenTexts[0]).toContain('aaa');
      expect(tokenTexts[1]).toContain('bbb');
      expect(tokenTexts[2]).toContain('ccc');
      expect(tokenTexts[3]).toContain('ddd');

      const value = ref.current?.getValue();
      expect(value).toContain('tag:is:aaa');
      expect(value).toContain('tag:is:bbb');
      expect(value).toContain('tag:is:ccc');
      expect(value).toContain('tag:is:ddd');
    });

    it("onDuplicate 'replace' keeps the last occurrence of each duplicate on paste", async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          validation={{ rules: [Unique.rule('exact', { onDuplicate: 'replace' })] }}
        />
      );

      // Paste: tag:is:aaa tag:is:bbb tag:is:ccc tag:is:ddd tag:is:aaa tag:is:ddd tag:is:bbb tag:is:aaa
      // Expected: ccc, ddd, bbb, aaa (last occurrence of each)
      await act(async () => {
        ref.current?.setValue(
          'tag:is:aaa tag:is:bbb tag:is:ccc tag:is:ddd tag:is:aaa tag:is:ddd tag:is:bbb tag:is:aaa'
        );
      });

      const tokens = document.querySelectorAll('.node-filterToken');
      expect(tokens.length).toBe(4);

      const value = ref.current?.getValue();
      expect(value).toContain('tag:is:aaa');
      expect(value).toContain('tag:is:bbb');
      expect(value).toContain('tag:is:ccc');
      expect(value).toContain('tag:is:ddd');

      // Verify order: last occurrences (ccc has no duplicate, so it stays at original position)
      // Original: aaa bbb ccc ddd aaa ddd bbb aaa
      // After: ccc ddd bbb aaa (last occurrences)
      const tokenTexts = Array.from(tokens).map((el) => el.textContent);
      expect(tokenTexts[0]).toContain('ccc');
      expect(tokenTexts[1]).toContain('ddd');
      expect(tokenTexts[2]).toContain('bbb');
      expect(tokenTexts[3]).toContain('aaa');
    });

    it("onDuplicate 'mark' marks only the later duplicate when setValue repeats an existing token", async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="tag:is:existing"
          validation={{ rules: [Unique.rule('exact', { onDuplicate: 'mark' })] }}
        />
      );

      // Wait for initial token
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });

      // Initially no tokens should be invalid
      let invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
      expect(invalidTokens.length).toBe(0);

      // Repeat the token via setValue
      ref.current?.setValue('tag:is:existing tag:is:existing');

      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(2);
        },
        { timeout: 2000 }
      );

      // setValue replaces the content, so both tokens are new and only the second one is marked
      await waitFor(
        () => {
          invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
          expect(invalidTokens.length).toBe(1);
        },
        { timeout: 2000 }
      );

      // Verify first token is NOT marked invalid (it's the survivor)
      const allTokens = document.querySelectorAll('.node-filterToken');
      const firstTokenInvalid = allTokens[0]?.querySelector('[data-invalid="true"]');
      expect(firstTokenInvalid).toBeFalsy();

      // Second token should be invalid
      const secondTokenInvalid = allTokens[1]?.querySelector('[data-invalid="true"]');
      expect(secondTokenInvalid).toBeTruthy();
    });
  });

  // A token the user edited in the focus session counts as edited, so the
  // onDuplicate value decides about it when the user leaves it.

  describe('Tokens edited in the focus session', () => {
    it("onDuplicate 'reject' deletes the token edited in the focus session", async () => {
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
        />
      );

      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });

      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);

      // Type a new duplicate and confirm with space
      await user.type(combobox, 'status:is:inactive ');

      // The new duplicate should be deleted ('reject')
      // because it is the token edited in the focus session
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 2000 }
      );

      // The original token should remain ('reject' keeps the token that was not edited)
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('active');
    });

    it("onDuplicate 'replace' keeps the token edited in the focus session", async () => {
      // Use delay to ensure each character is fully processed before the next
      const user = userEvent.setup({ delay: 10 });

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Verify initial state
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
        expect(tokens[0]?.textContent).toContain('active');
      });

      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);

      // Type a new duplicate and confirm with space
      await user.type(combobox, 'status:is:inactive ');

      // Wait for second token to appear momentarily (before deletion)
      // then verify final state
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 2000 }
      );

      // The new token should remain ('replace' keeps the token that was edited)
      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('inactive');
      });
    });
  });

  // setValue() creates a single undo step: undo reverts to the state BEFORE setValue,
  // not to an intermediate state with duplicates.

  describe('Undo behavior with validation', () => {
    it("onDuplicate 'replace': undo restores original token after replace deletion", async () => {
      // Scenario:
      // 1. Start with [status:active]
      // 2. setValue to [status:active, status:inactive] -> 'replace' deletes active
      // 3. Undo -> restores to [status:active] (the state before setValue)
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Initial state: 1 token (active)
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
        expect(tokens[0]?.textContent).toContain('active');
      });

      // Add duplicate via setValue ('replace' deletes active, inactive remains)
      ref.current?.setValue('status:is:active status:is:inactive');

      // After 'replace': only inactive remains
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 1000 }
      );

      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('inactive');
      });

      // Trigger undo
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);
      await user.keyboard('{Control>}z{/Control}');

      // After undo: restores to original state (before setValue)
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 2000 }
      );

      // Original token (active) should be restored
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('active');
    });

    it("onDuplicate 'reject': undo restores original token after reject deletion", async () => {
      // Scenario:
      // 1. Start with [status:active]
      // 2. setValue to [status:active, status:inactive] -> 'reject' deletes inactive
      // 3. Undo -> restores to [status:active] (the state before setValue)
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
        />
      );

      // Initial state: 1 token (active)
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
        expect(tokens[0]?.textContent).toContain('active');
      });

      // Add duplicate via setValue ('reject' deletes inactive, active remains)
      ref.current?.setValue('status:is:active status:is:inactive');

      // After 'reject': only active remains ('reject' keeps the first)
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 1000 }
      );

      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('active');
      });

      // Trigger undo
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);
      await user.keyboard('{Control>}z{/Control}');

      // After undo: restores to original state (before setValue)
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 2000 }
      );

      // Original token (active) should remain
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('active');
    });

    it("onDuplicate 'mark': undo restores single token after marked duplicates", async () => {
      // Scenario:
      // 1. Start with [status:active]
      // 2. setValue to [status:active, status:inactive] -> second marked invalid
      // 3. Undo -> restores to [status:active] (the state before setValue)
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'mark' })] }}
        />
      );

      // Initial state: 1 token
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });

      // Add duplicate via setValue
      ref.current?.setValue('status:is:active status:is:inactive');

      // onDuplicate 'mark': both remain, second is marked
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(2);
        },
        { timeout: 1000 }
      );

      await waitFor(() => {
        const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
        expect(invalidTokens.length).toBe(1);
      });

      // Trigger undo
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);
      await user.keyboard('{Control>}z{/Control}');

      // After undo: restores to original state (before setValue)
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 2000 }
      );

      // The remaining token should not be invalid
      const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
      expect(invalidTokens.length).toBe(0);
    });

    it("onDuplicate 'replace' on setValue from an empty editor keeps the last token", async () => {
      // Starting from an empty document, every token set by setValue is new and so
      // counts as edited. 'replace' then keeps the last one.
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Start empty
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(0);
      });

      // setValue with duplicates (all tokens are new, so all count as edited)
      ref.current?.setValue('status:is:first status:is:second status:is:third');

      // 'replace' keeps the last token
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 1000 }
      );

      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('third');
    });

    it('Paste from empty then undo: expected to return to empty', async () => {
      // Scenario:
      // 1. Start empty
      // 2. Paste "status:is:active" (single token, no duplicates)
      // 3. onDuplicate 'replace' runs (no duplicates, so the token remains)
      // 4. Undo -> editor becomes empty (this is EXPECTED - undo reverts to state BEFORE paste)
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Start empty
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(0);
      });

      // Simulate paste via setValue (since actual paste is hard to test)
      ref.current?.setValue('status:is:active');

      // Token should exist
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 1000 }
      );

      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('active');
      });

      // Trigger undo
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);
      await user.keyboard('{Control>}z{/Control}');

      // After undo: should restore to empty (state before setValue)
      // This is expected behavior - undo reverts to state BEFORE the paste
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(0);
        },
        { timeout: 2000 }
      );
    });

    it('restores the original token on undo after a pasted duplicate replaced it', async () => {
      // 1. Start with existing token [status:active]
      // 2. Paste duplicate "status:inactive" -> 'replace' deletes active, keeps inactive
      // 3. Undo -> should restore [status:active], not become empty
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Initial state: 1 token (active)
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
        expect(tokens[0]?.textContent).toContain('active');
      });

      // Simulate paste that creates a duplicate, using setValue to stand in for the paste
      ref.current?.setValue('status:is:active status:is:inactive');

      // After 'replace': only inactive remains
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 1000 }
      );

      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('inactive');
      });

      // Trigger undo
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(combobox);
      await user.keyboard('{Control>}z{/Control}');

      // After undo: should restore to original state [status:active]
      // NOT empty!
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
          expect(tokens[0]?.textContent).toContain('active');
        },
        { timeout: 2000 }
      );
    });

    it("Undo via editor.commands.undo() after onDuplicate 'replace'", async () => {
      // Test using editor.commands.undo() directly instead of keyboard shortcut
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        />
      );

      // Initial state: 1 token (active)
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
        expect(tokens[0]?.textContent).toContain('active');
      });

      // Simulate paste that creates a duplicate
      ref.current?.setValue('status:is:active status:is:inactive');

      // After 'replace': only inactive remains
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 1000 }
      );

      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('inactive');
      });

      // Use editor.commands.undo() directly
      const editorRef = ref.current;
      expect(editorRef).not.toBeNull();
      const editor = editorRef ? getInternalEditor(editorRef) : null;
      expect(editor).not.toBeNull();
      editor?.commands.undo();

      // After undo: should restore to original state [status:active]
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
          expect(tokens[0]?.textContent).toContain('active');
        },
        { timeout: 2000 }
      );
    });
  });
  describe('Validation marks while a value is edited', () => {
    it('fires onChange once per edit and keeps the value suggestions open', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const ref = createRef<TokenizedSearchInputRef>();
      const enumFields: FieldDefinition[] = [
        {
          key: 'status',
          label: 'Status',
          type: 'enum',
          operators: ['is'],
          enumValues: ['active', 'archived', 'pending'],
        },
      ];
      const minLength: ValidationRule = {
        id: 'min-length',
        validate: (ctx) =>
          ctx.tokens
            .filter((t) => t.value.length < 3)
            .map((t) => ({
              ruleId: 'min-length',
              reason: 'too-short',
              action: 'mark' as const,
              targets: [{ tokenId: t.id }],
            })),
      };
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={enumFields}
          defaultValue="status:is:arc"
          onChange={onChange}
          validation={{ rules: [minLength] }}
        />
      );
      await expectTokenCounts(1, 0);
      const editor = getInternalEditor(ref.current);
      if (!editor) throw new Error('editor not created');

      await user.click(screen.getByRole('group', { name: /Filter: status/i }));
      await screen.findByRole('listbox');

      const suggestionTypes: SuggestionType[] = [];
      const recordSuggestion = () => {
        suggestionTypes.push(getSuggestionState(editor.state)?.type ?? null);
      };
      editor.on('transaction', recordSuggestion);
      const callsBefore = onChange.mock.calls.length;

      await user.keyboard('{Backspace}');

      await expectTokenCounts(1, 1);
      expect(ref.current?.getValue()).toBe('status:is:ar');
      expect(onChange.mock.calls.length - callsBefore).toBe(1);
      expect(suggestionTypes).not.toContain(null);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      editor.off('transaction', recordSuggestion);
    });
  });
});
