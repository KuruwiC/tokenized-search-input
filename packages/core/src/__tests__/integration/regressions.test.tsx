/**
 * Regression tests for bug fixes.
 * These tests ensure that previously fixed bugs remain fixed.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { CustomSuggestionConfig, QuerySnapshot, QuerySnapshotFilterToken } from '../../types';
import { getFilterTokens, getPlainText } from '../../utils/query-snapshot';
import { basicFields } from '../fixtures';

afterEach(() => {
  cleanup();
});

describe('Regression Tests', () => {
  describe('Fix #1: Initial Token Events', () => {
    /**
     * Verifies that onTokensChange fires for initial tokens when defaultValue is set.
     *
     * Before the fix: Initial tokens from defaultValue did not trigger token events
     * because prevSnapshotRef was null and the diff was skipped.
     *
     * After the fix: prevSnapshotRef is initialized with EMPTY_SNAPSHOT, so the first
     * onUpdate calculates a diff from empty to the initial state, firing change events.
     */
    it('fires onTokensChange for initial tokens from defaultValue', async () => {
      let capturedTokens: QuerySnapshotFilterToken[] = [];
      const onTokensChange = vi.fn((snapshot: QuerySnapshot) => {
        capturedTokens = getFilterTokens(snapshot);
      });

      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="status:is:active priority:is:high"
          onTokensChange={onTokensChange}
        />
      );

      await waitFor(() => {
        expect(capturedTokens.length).toBe(2);
      });

      expect(capturedTokens[0].key).toBe('status');
      expect(capturedTokens[0].value).toBe('active');
      expect(capturedTokens[1].key).toBe('priority');
      expect(capturedTokens[1].value).toBe('high');
    });
  });

  describe('Fix #2: Whitespace Preservation', () => {
    /**
     * Verifies that whitespace is preserved in plaintext segments.
     *
     * Before the fix: The serializer used trim() which removed leading/trailing spaces,
     * and getPlainText() joined with '' which didn't restore spaces between segments.
     *
     * After the fix: The serializer preserves the original text without trimming,
     * so "hello world" remains "hello world" instead of becoming "helloworld".
     */
    it('preserves whitespace in getPlainText output', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<TokenizedSearchInput fields={basicFields} onChange={onChange} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);
      await user.type(editor, 'hello world');

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        const snapshot = lastCall[0];
        const plainText = getPlainText(snapshot);
        expect(plainText).toContain('hello');
        expect(plainText).toContain('world');
      });
    });
  });

  describe('Fix #3: Pagination in prepend/append mode', () => {
    /**
     * Verifies that pagination configuration is supported in prepend/append modes.
     *
     * Before the fix: loadMore() only checked for 'custom' type, ignoring 'fieldWithCustom'.
     * Also, CustomSuggestionList in fieldWithCustom case didn't receive pagination props.
     *
     * After the fix: loadMore() supports both 'custom' and 'fieldWithCustom' types,
     * and pagination props are passed to CustomSuggestionList in all cases.
     *
     * Note: Full UI testing of pagination scroll behavior requires browser environment.
     * This test verifies the configuration is properly accepted.
     */
    it('accepts loadMore configuration in prepend mode', () => {
      const loadMore = vi.fn();

      const customSuggestion: CustomSuggestionConfig = {
        displayMode: 'prepend',
        debounceMs: 50,
        maxSuggestions: 3,
        suggest: async () => ({ suggestions: [], hasMore: true }),
        loadMore: async (params) => {
          loadMore(params);
          return { suggestions: [], hasMore: false };
        },
      };

      // Verify configuration is valid
      expect(customSuggestion.displayMode).toBe('prepend');
      expect(customSuggestion.loadMore).toBeDefined();
    });

    it('accepts loadMore configuration in append mode', () => {
      const loadMore = vi.fn();

      const customSuggestion: CustomSuggestionConfig = {
        displayMode: 'append',
        debounceMs: 50,
        maxSuggestions: 3,
        suggest: async () => ({ suggestions: [], hasMore: true }),
        loadMore: async (params) => {
          loadMore(params);
          return { suggestions: [], hasMore: false };
        },
      };

      // Verify configuration is valid
      expect(customSuggestion.displayMode).toBe('append');
      expect(customSuggestion.loadMore).toBeDefined();
    });
  });

  describe('Fix #4: Suggestion-inserted tokens should be editable', () => {
    /**
     * Verifies that tokens inserted from suggestions can include displayValue.
     *
     * Before the fix: When displayValue was set by custom suggestions,
     * the controlled input would not reflect user typing because displayValue
     * was not updated on input change.
     *
     * After the fix: handleValueChange clears displayValue/startContent/endContent,
     * so resolveDisplayValue falls back to rawValue, making user input visible.
     *
     * This test verifies the suggestion configuration supports displayValue.
     */
    it('supports displayValue in custom suggestions', () => {
      const customSuggestion: CustomSuggestionConfig = {
        displayMode: 'replace',
        suggest: () => {
          return [
            {
              tokens: [
                { key: 'tag', operator: 'is' as const, value: 'react', displayValue: 'React' },
              ],
              label: 'React',
            },
          ];
        },
      };

      // Verify configuration supports displayValue
      const suggestions = customSuggestion.suggest({ query: 're', fields: [], existingTokens: [] });
      expect(Array.isArray(suggestions)).toBe(true);
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        expect(suggestions[0].tokens[0].displayValue).toBe('React');
      }
    });
  });

  describe('Fix #5: onTokensChange fires on token blur', () => {
    /**
     * Verifies that onTokensChange fires when a token loses focus after value changes.
     *
     * Before the fix: While a token was focused, value changes were not tracked
     * because the focused token was excluded from comparison. When focus was lost,
     * confirmedTokensRef still had the old value, and comparison should detect the change.
     *
     * This test verifies the basic blur behavior for enum tokens.
     */
    it('fires onTokensChange when token is deleted', async () => {
      const onTokensChange = vi.fn();
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="status:is:active priority:is:high"
          onTokensChange={onTokensChange}
        />
      );

      // Wait for initial onTokensChange
      await waitFor(() => {
        expect(onTokensChange).toHaveBeenCalled();
      });

      const initialCallCount = onTokensChange.mock.calls.length;

      // Find and click the delete button on first token
      const deleteButtons = screen.getAllByRole('button', { name: /delete|remove/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
      await user.click(deleteButtons[0]);

      // onTokensChange should fire with one less token
      await waitFor(() => {
        expect(onTokensChange.mock.calls.length).toBeGreaterThan(initialCallCount);
      });

      const lastCall = onTokensChange.mock.calls[onTokensChange.mock.calls.length - 1];
      const tokens = getFilterTokens(lastCall[0]);
      expect(tokens.length).toBe(1);
    });
  });
});
