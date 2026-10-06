/**
 * Integration tests for the validation system.
 * Tests validation rules, duplicate detection, and constraint behaviors.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { getSuggestionState, type SuggestionType } from '../../plugins/suggestion';
import { getFocusedTokenId } from '../../plugins/token-focus';
import type { FieldDefinition, ValidationRule } from '../../types';
import { MaxCount, RequirePattern, Unique } from '../../validation/presets';
import { fieldsWithValidationOverride } from '../fixtures';
import { getInternalEditor, waitForEditor } from '../helpers/get-editor';
import { filterTokens, invalidTokenCount } from '../helpers/token-queries';

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

/**
 * Runs the animation frames requested so far, and the frames they request in turn, with
 * React's updates from them applied.
 */
async function flushFrames(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

/** Renders the input with `rules` and no content, and waits for its editor. */
async function renderWithRules(rules: ValidationRule[]) {
  const ref = createRef<TokenizedSearchInputRef>();
  render(<TokenizedSearchInput ref={ref} fields={testFields} validation={{ rules }} />);
  const editor = await waitForEditor(ref);
  return { ref, editor };
}

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

  describe('Competing rules on one token', () => {
    it("shows the higher-priority rule's message whatever order the rules are given in", async () => {
      const flagStatus = (id: string, message: string, priority: number): ValidationRule => ({
        id,
        priority,
        validate: (ctx) =>
          ctx.tokens
            .filter((t) => t.key === 'status')
            .map((t) => ({
              ruleId: id,
              reason: id,
              message,
              action: 'mark' as const,
              targets: [{ tokenId: t.id }],
            })),
      });

      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{
            rules: [
              flagStatus('low', 'Low priority message', 10),
              flagStatus('high', 'High priority message', 100),
            ],
          }}
        />
      );

      await expectTokenCounts(1, 1);
      expect(screen.getByRole('group', { name: /status/i })).toHaveAttribute(
        'title',
        'High priority message'
      );
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
      const { ref } = await renderWithRules([Unique.rule('key')]);

      act(() => {
        ref.current?.setValue('status:is:active status:is:inactive');
      });

      await expectTokenCounts(2, 1);
    });

    it('deletes duplicates on setValue', async () => {
      const { ref } = await renderWithRules([Unique.rule('key', { onDuplicate: 'reject' })]);

      act(() => {
        ref.current?.setValue('status:is:active status:is:inactive priority:is:high');
      });

      // status + priority (duplicate status deleted)
      await expectTokenCounts(2, 0);
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

  describe('onDuplicate replace: position-independent behavior', () => {
    it("onDuplicate 'replace' with 3 duplicates keeps only the last token on setValue", async () => {
      const { ref } = await renderWithRules([Unique.rule('key', { onDuplicate: 'replace' })]);
      act(() => {
        ref.current?.setValue('status:is:first status:is:second status:is:third');
      });

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
      const { ref } = await renderWithRules([Unique.rule('key', { onDuplicate: 'reject' })]);
      // The second token is the later duplicate
      act(() => {
        ref.current?.setValue('status:is:first status:is:second');
      });

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
      const { ref } = await renderWithRules([Unique.rule('key', { onDuplicate: 'replace' })]);
      act(() => {
        ref.current?.setValue('status:is:first status:is:second');
      });

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
      const { ref } = await renderWithRules([Unique.rule('key', { onDuplicate: 'reject' })]);
      act(() => {
        ref.current?.setValue('status:is:first status:is:second status:is:third');
      });

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
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
        />
      );

      const editor = await waitForEditor(ref);
      // The snapshot leaves out a token without a value, so the ids are read from the document.
      const tokenIds = () => {
        const ids: string[] = [];
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'filterToken') ids.push(node.attrs.id);
        });
        return ids;
      };
      const [existing] = tokenIds();

      // The click leaves the caret before the token; the duplicate is added after it.
      await user.click(document.querySelector('[role="combobox"]') as HTMLElement);
      act(() => {
        editor.commands.focus('end');
      });
      await user.click(await screen.findByRole('option', { name: /Status/ }));

      // The new token is marked while the user is in it ('reject' deletes it only after they leave)
      await waitFor(() => {
        const ids = tokenIds();
        expect(ids).toHaveLength(2);
        const added = ids.findIndex((id) => id !== existing);
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(invalidTokenCount()).toBe(1);
        expect(tokens[added]?.querySelector('[data-invalid="true"]')).not.toBeNull();
      });
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

      const { ref, editor } = await renderWithRules([Unique.rule('key', { onDuplicate: 'mark' })]);
      act(() => {
        ref.current?.setValue('priority:is:medium priority:is:high');
      });

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
      // A click is followed by the suggestions being evaluated again on the next frame
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      await user.click(firstToken);
      await waitFor(() => expect(combobox).toHaveAttribute('aria-expanded', 'true'));
      await flushFrames();

      await user.click(combobox);
      await flushFrames();
      await user.keyboard('{Escape}');
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
      await flushFrames();
      expect(getFocusedTokenId(editor.state)).toBeNull();

      // After blur, marking should remain consistent (1 token marked)
      expect(invalidTokenCount()).toBe(1);
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
  });

  describe('duplicates among pasted tokens', () => {
    const pasted =
      'tag:is:aaa tag:is:bbb tag:is:ccc tag:is:ddd tag:is:aaa tag:is:ddd tag:is:bbb tag:is:aaa';

    async function pasteInto(onDuplicate: 'reject' | 'replace') {
      const ref = createRef<TokenizedSearchInputRef>();
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          validation={{ rules: [Unique.rule('exact', { onDuplicate })] }}
        />
      );
      const editor = await waitForEditor(ref);
      act(() => {
        editor.view.pasteText(pasted, new Event('paste') as ClipboardEvent);
      });
      return ref;
    }

    it("onDuplicate 'reject' keeps the first occurrence of each duplicate on paste", async () => {
      const ref = await pasteInto('reject');

      await waitFor(() =>
        expect(ref.current?.getValue()).toBe('tag:is:aaa tag:is:bbb tag:is:ccc tag:is:ddd')
      );
    });

    it("onDuplicate 'replace' keeps the last occurrence of each duplicate on paste", async () => {
      const ref = await pasteInto('replace');

      // ccc has no duplicate, so it keeps its place ahead of the last occurrences of the others
      await waitFor(() =>
        expect(ref.current?.getValue()).toBe('tag:is:ccc tag:is:ddd tag:is:bbb tag:is:aaa')
      );
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
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
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
      expect(ref.current?.getValue()).toBe('status:is:active');
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
    const undoBy = {
      keyboard: async () => {
        const user = userEvent.setup();
        await user.click(document.querySelector('[role="combobox"]') as HTMLElement);
        await user.keyboard('{Control>}z{/Control}');
      },
      command: async (editor: Editor) => {
        act(() => {
          editor.commands.undo();
        });
      },
    };

    async function renderWithDuplicateRule(onDuplicate: 'reject' | 'replace') {
      const ref = createRef<TokenizedSearchInputRef>();
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate })] }}
        />
      );
      const editor = await waitForEditor(ref);
      return { ref, editor };
    }

    it.each([
      'keyboard',
      'command',
    ] as const)("onDuplicate 'replace': undo by %s restores the token that setValue replaced", async (via) => {
      const { ref, editor } = await renderWithDuplicateRule('replace');

      act(() => {
        ref.current?.setValue('status:is:active status:is:inactive');
      });
      await waitFor(() => expect(ref.current?.getValue()).toBe('status:is:inactive'));

      await undoBy[via](editor);

      await waitFor(() => expect(ref.current?.getValue()).toBe('status:is:active'));
    });

    it("onDuplicate 'reject': undo restores the original token after reject deletion", async () => {
      const { ref, editor } = await renderWithDuplicateRule('reject');
      const [original] = filterTokens(ref);

      // setValue replaces the content, so the token 'reject' keeps is a new one
      act(() => {
        ref.current?.setValue('status:is:active status:is:inactive');
      });
      await waitFor(() => expect(ref.current?.getValue()).toBe('status:is:active'));
      expect(filterTokens(ref).map((t) => t.id)).not.toEqual([original?.id]);

      await undoBy.command(editor);

      await waitFor(() => expect(filterTokens(ref).map((t) => t.id)).toEqual([original?.id]));
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
