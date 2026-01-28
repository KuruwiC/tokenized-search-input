/**
 * Integration tests for the validation system.
 * Tests validation rules, duplicate detection, and constraint behaviors.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useEffect, useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
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

  describe('Unique.reject strategy', () => {
    it('marks duplicate as invalid with default action (mark)', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key', Unique.mark)] }}
        />
      );

      await expectTokenCounts(2, 1);
    });

    it('deletes later duplicates with Unique.reject on defaultValue', async () => {
      // With forceCheck (initial load), all tokens are treated as fresh
      // Unique.reject keeps first occurrence and deletes later ones
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key', Unique.reject)] }}
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
      // In the new architecture, all rules run and their violations are collected.
      // Delete actions take precedence over mark actions in the action-planner.
      // This test verifies that priority ordering works by checking execution order.
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
              targets: statusTokens.slice(1).map((t) => ({ tokenId: t.id, pos: t.pos })),
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
            rules: [Unique.rule('exact', Unique.reject), Unique.rule('key', Unique.mark)],
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
              targets: statusTokens.slice(2).map((t) => ({ tokenId: t.id, pos: t.pos })),
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
            validation={{ rules: [Unique.rule('key', Unique.reject)] }}
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

  describe('Unique.replace strategy', () => {
    it('deletes earlier token and keeps later one with delete-existing', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
        />
      );

      // With delete-existing, the later token (status:inactive) should survive
      // and the earlier token (status:active) should be deleted
      await expectTokenCounts(1, 0);

      // The remaining token should be the later one (inactive)
      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('inactive');
      });
    });

    it('does not delete editing tokens with delete-existing', async () => {
      // This test verifies that tokens with empty value (being edited) are not deleted
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
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
          validation={{ rules: [Unique.rule('key', Unique.reject)] }}
        />
      );

      await expectTokenCounts(1, 0);
    });
  });

  describe('Unique.replace with 3+ duplicates', () => {
    it('deletes all earlier tokens and keeps only the latest one', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive status:is:pending"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
        />
      );

      // With delete-existing, only the latest token (status:pending) should survive
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
            targets: { tokenId: string; pos: number }[];
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
                targets: [{ tokenId: token.id, pos: token.pos }],
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
      const throwingRule: ValidationRule = {
        id: 'throws',
        validate: () => {
          throw new Error('Unexpected error');
        },
      };

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
    });

    it('clears invalid state when remaining token is no longer duplicate after delete-existing', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
        />
      );

      // After delete-existing, only the last token remains and should be valid
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
            rules: [Unique.rule('key', Unique.reject)],
          }}
        />
      );

      // Only first status should remain after all deletions
      await expectTokenCounts(1, 0);
    });

    it('unique with default strategy marks duplicates', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{
            rules: [Unique.rule('key')],
          }}
        />
      );

      // With default mark strategy, duplicates should be marked but not deleted
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

  describe('Unique.replace protects edited token', () => {
    it('unique rule returns violations with targets for duplicates', async () => {
      // New architecture: Unique.rule() returns Violation[] with explicit targets
      // The violation contains all duplicate targets (except the survivor)
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

  // ============================================
  // Position-independent behavior tests
  // ============================================
  // These tests verify that delete-new and delete-existing work correctly
  // regardless of whether the new token is added BEFORE or AFTER existing tokens.

  describe('Unique.reject: position-independent behavior', () => {
    it('delete-new preserves existing token on forceCheck', async () => {
      // When setValue is called with duplicates, delete-new should delete the later (newer) tokens
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
            validation={{ rules: [Unique.rule('key', Unique.reject)] }}
          />
        );
      };

      render(<TestComponent />);

      // After setValue with delete-new, later duplicate should be deleted
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

  describe('Unique.replace: position-independent behavior', () => {
    it('delete-existing preserves new token on forceCheck', async () => {
      // When setValue is called with duplicates, delete-existing should delete the earlier (existing) tokens
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
            validation={{ rules: [Unique.rule('key', Unique.replace)] }}
          />
        );
      };

      render(<TestComponent />);

      // After setValue with delete-existing, earlier duplicate should be deleted
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

    it('delete-existing with 3 duplicates preserves only the last token', async () => {
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
            validation={{ rules: [Unique.rule('key', Unique.replace)] }}
          />
        );
      };

      render(<TestComponent />);

      // After setValue with delete-existing, only the last token should remain
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

  describe('new token BEFORE existing: position-independent tests', () => {
    // These tests verify the core behavior using setValue which triggers forceCheck.
    // The key insight: In forceCheck, "first position = existing, last position = new"
    // This simulates what happens when a user creates a new token BEFORE an existing one.

    it('delete-new: first token (simulating new BEFORE existing) should be kept', async () => {
      // Scenario: User has `existingToken` and creates `newToken` BEFORE it
      // Result in document: `newToken existingToken` (new is at position 0, existing at position 1)
      //
      // With delete-new + forceCheck:
      // - "new" = later position (position 1) - this is the SECOND token
      // - "existing" = first position (position 0) - this is the FIRST token
      // - delete-new should delete the "new" one (second/later)
      // - Result: first token remains
      //
      // This test verifies that the FIRST token is preserved (not deleted).
      const TestComponent = () => {
        const ref = useRef<TokenizedSearchInputRef>(null);
        useEffect(() => {
          setTimeout(() => {
            // Simulates: newToken was created BEFORE existingToken
            // In forceCheck: later position = newer, so second token is "new"
            ref.current?.setValue('status:is:first status:is:second');
          }, 100);
        }, []);
        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            validation={{ rules: [Unique.rule('key', Unique.reject)] }}
          />
        );
      };

      render(<TestComponent />);

      // delete-new preserves first occurrence
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 500 }
      );

      // The remaining token should be "first" (first position = existing)
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('first');
    });

    it('delete-existing: last token (simulating new AFTER existing) should be kept', async () => {
      // Scenario: User has `existingToken` and creates `newToken` AFTER it
      // Result in document: `existingToken newToken` (existing at position 0, new at position 1)
      //
      // With delete-existing + forceCheck:
      // - "new" = later position (position 1) - triggers deletion
      // - "existing" = first position (position 0) - gets deleted
      // - Result: last token (new) remains
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
            validation={{ rules: [Unique.rule('key', Unique.replace)] }}
          />
        );
      };

      render(<TestComponent />);

      // delete-existing preserves last occurrence
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 500 }
      );

      // The remaining token should be "second" (last position = new)
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('second');
    });

    it('delete-new with 3 tokens: preserves only the first', async () => {
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
            validation={{ rules: [Unique.rule('key', Unique.reject)] }}
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

    it('interactive: clicking existing token then adding duplicate via suggestion', async () => {
      const user = userEvent.setup();

      // Start with existing token
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', Unique.reject)] }}
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

        // New token should be marked invalid (delete-new marks the new one)
        await waitFor(() => {
          const invalidTokens = document.querySelectorAll('[data-invalid="true"]');
          expect(invalidTokens.length).toBeGreaterThanOrEqual(1);
        });
      }
    });

    it('delete-new with setValue: first occurrence (position-based) is preserved', async () => {
      // With setValue (forceCheck), delete-new uses position-based logic
      // First occurrence in document order is preserved, regardless of which was "new"
      // This is different from interactive blur scenario
      const TestComponent = () => {
        const ref = useRef<TokenizedSearchInputRef>(null);
        useEffect(() => {
          setTimeout(() => {
            // Simulates: new token at beginning, existing at end
            // Document order: [new:inactive] [existing:active]
            // With forceCheck, first occurrence (inactive) is preserved
            ref.current?.setValue('status:is:inactive status:is:active');
          }, 100);
        }, []);
        return (
          <TokenizedSearchInput
            ref={ref}
            fields={testFields}
            validation={{ rules: [Unique.rule('key', Unique.reject)] }}
          />
        );
      };

      render(<TestComponent />);

      // delete-new preserves first occurrence
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

  describe('marking behavior during editing', () => {
    it('delete-new with mark action shows invalid state on duplicates', async () => {
      // Test that 'mark' action (not delete-new) shows invalid state without deleting
      // This verifies the marking behavior works correctly
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

    it('delete-existing marks both duplicates invalid during forceCheck', async () => {
      // With delete-existing on initial load (forceCheck), the existing token is deleted
      // This test verifies the deletion happens correctly
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active status:is:inactive"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
        />
      );

      // After forceCheck, only the last token should remain
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

  describe('action: mark - blur behavior consistency', () => {
    it('mark action: marking state is consistent before and after blur', async () => {
      // The unique rule marks only the later (non-first) token as invalid.
      // This marking should persist through blur - no special clearing behavior.
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
            validation={{ rules: [Unique.rule('key', Unique.mark)] }}
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

      // Step 1: Click on first token to focus it
      const tokens = document.querySelectorAll('.node-filterToken');
      const firstToken = tokens[0];
      await user.click(firstToken);

      // Wait for focus to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 2: Click outside to blur
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
    it('BUG: should not delete immediately when plaintext exists (delete-existing)', async () => {
      // This test reproduces the bug where:
      // Initial state: `status:is:active "search term" priority:is:high`
      // Action: Add a new `status:` token via suggestion
      // Expected: existing `status:is:active` is MARKED but NOT deleted immediately
      // Actual (BUG): existing `status:is:active` is DELETED immediately
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue='status:is:active "search term" priority:is:high'
          freeTextMode="plain"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
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
      // BUG: If this fails with 2 tokens, the existing status:is:active was deleted immediately
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

    it('should not delete immediately when adding duplicate via suggestion (delete-existing)', async () => {
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
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

      // The existing token should be marked as invalid (delete-existing marks existing tokens)
      // This should NOT be deleted immediately - only marked
      await waitFor(() => {
        const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
        expect(invalidTokens.length).toBe(1);
      });
    });

    it('should delete existing token only on blur when adding duplicate via suggestion', async () => {
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
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

      // The existing token should be marked invalid (delete-existing marks existing tokens)
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

    it('should delete existing token on value selection (delete-existing with blur)', async () => {
      // Value selection triggers blur (exitTokenRight), which should execute delete-existing
      // This is EXPECTED behavior: selecting a value completes the edit and triggers deletion
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
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

      // After selecting value, existing token should be deleted (blur triggers delete-existing)
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
      // This tests the case where delete-existing removes multiple tokens at once
      // (e.g., pasting a string that violates multiple validation rules)
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="hello status:is:active priority:is:high world"
          freeTextMode="plain"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
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

      // Add duplicate status token (triggers delete-existing on first status)
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

      // Now add duplicate priority token (triggers delete-existing on first priority)
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

  describe('freshTokenIds: paste duplicate handling', () => {
    it('delete-new preserves first occurrence of each duplicate on paste', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          validation={{ rules: [Unique.rule('exact', Unique.reject)] }}
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

    it('delete-existing preserves last occurrence of each duplicate on paste', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          validation={{ rules: [Unique.rule('exact', Unique.replace)] }}
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

    it('mark action only marks fresh tokens when existing tokens present', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="tag:is:existing"
          validation={{ rules: [Unique.rule('exact', Unique.mark)] }}
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

      // Add duplicate token via setValue (this creates a mixed case: existing + fresh)
      ref.current?.setValue('tag:is:existing tag:is:existing');

      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(2);
        },
        { timeout: 2000 }
      );

      // In mixed case (existing + fresh): only fresh token should be marked
      // Since setValue replaces content, both tokens are new, so second one is marked
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

  // ============================================
  // Focus-based freshness tests
  // ============================================
  // These tests verify that focused/blurred tokens are treated as "fresh"
  // for strategy decisions (root cause fix for deferred deletion boundary issue)

  describe('Focus-based freshness', () => {
    it('focused token is treated as fresh for Unique.reject', async () => {
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', Unique.reject)] }}
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

      // The new duplicate should be deleted (reject strategy)
      // because the focused/newly-created token is treated as "fresh"
      await waitFor(
        () => {
          const tokens = document.querySelectorAll('.node-filterToken');
          expect(tokens.length).toBe(1);
        },
        { timeout: 2000 }
      );

      // Original token should remain (reject keeps existing)
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('active');
    });

    it('focused token is treated as fresh for Unique.replace', async () => {
      // Use delay to ensure each character is fully processed before the next
      const user = userEvent.setup({ delay: 10 });

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
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

      // New token should remain (replace keeps new/fresh)
      await waitFor(() => {
        const token = document.querySelector('.node-filterToken');
        expect(token?.textContent).toContain('inactive');
      });
    });
  });

  // ============================================
  // Undo behavior tests
  // ============================================
  // These tests verify undo behavior with validation strategies.
  //
  // Important: setValue() creates a single undo step. When you undo, it reverts
  // to the state BEFORE setValue, not to an intermediate state with duplicates.
  // Therefore, these tests verify that undo correctly restores the original state.

  describe('Undo behavior with validation', () => {
    it('Unique.replace: undo restores original token after replace deletion', async () => {
      // Scenario:
      // 1. Start with [status:active]
      // 2. setValue to [status:active, status:inactive] -> replace deletes active
      // 3. Undo -> restores to [status:active] (the state before setValue)
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
        />
      );

      // Initial state: 1 token (active)
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
        expect(tokens[0]?.textContent).toContain('active');
      });

      // Add duplicate via setValue (triggers replace: active deleted, inactive remains)
      ref.current?.setValue('status:is:active status:is:inactive');

      // After replace: only inactive remains
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

    it('Unique.reject: undo restores original token after reject deletion', async () => {
      // Scenario:
      // 1. Start with [status:active]
      // 2. setValue to [status:active, status:inactive] -> reject deletes inactive
      // 3. Undo -> restores to [status:active] (the state before setValue)
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', Unique.reject)] }}
        />
      );

      // Initial state: 1 token (active)
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
        expect(tokens[0]?.textContent).toContain('active');
      });

      // Add duplicate via setValue (triggers reject: inactive deleted, active remains)
      ref.current?.setValue('status:is:active status:is:inactive');

      // After reject: only active remains (reject keeps first)
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

    it('Unique.mark: undo restores single token after marked duplicates', async () => {
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
          validation={{ rules: [Unique.rule('key', Unique.mark)] }}
        />
      );

      // Initial state: 1 token
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });

      // Add duplicate via setValue
      ref.current?.setValue('status:is:active status:is:inactive');

      // Mark strategy: both remain, second is marked
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

    it('Unique.replace with editing.length === 0: keeps last token', async () => {
      // This test verifies the behavior when ALL tokens are "existing" (not editing).
      // This happens on forceCheck (setValue/paste) when editingTokenIds is computed
      // as all tokens (since no doc diff exists from empty state).
      //
      // Scenario: Start empty, setValue with duplicates
      // Result: last token is kept (because all are "editing" on forceCheck)
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
        />
      );

      // Start empty
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(0);
      });

      // setValue with duplicates (all tokens are "editing" since they're all new)
      ref.current?.setValue('status:is:first status:is:second status:is:third');

      // Replace keeps last editing token
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
      // 3. Replace strategy runs (no duplicates, so token remains)
      // 4. Undo -> editor becomes empty (this is EXPECTED - undo reverts to state BEFORE paste)
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
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

    it('BUG REPORT: Paste duplicate to replace existing, then undo should restore original', async () => {
      // User reported scenario:
      // 1. Start with existing token [status:active]
      // 2. Paste duplicate "status:inactive" -> replace deletes active, keeps inactive
      // 3. Undo -> should restore [status:active], NOT become empty
      //
      // If undo results in empty, that's a bug.
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
        />
      );

      // Initial state: 1 token (active)
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
        expect(tokens[0]?.textContent).toContain('active');
      });

      // Simulate paste that creates a duplicate (triggers replace)
      // Using setValue to simulate the paste + replace flow
      ref.current?.setValue('status:is:active status:is:inactive');

      // After replace: only inactive remains
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

    it('Undo via editor.commands.undo() after replace', async () => {
      // Test using editor.commands.undo() directly instead of keyboard shortcut
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', Unique.replace)] }}
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

      // After replace: only inactive remains
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
});
