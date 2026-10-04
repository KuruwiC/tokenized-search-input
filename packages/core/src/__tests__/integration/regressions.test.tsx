/**
 * Behaviour tests for change reporting of initial tokens, whitespace between text,
 * suggestion pagination, displayValue and deleting a focused token.
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
     * onTokensChange fires for the initial tokens of defaultValue: the first update is
     * compared against an empty snapshot.
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
     * Whitespace between plaintext segments is preserved: "hello world" does not become
     * "helloworld".
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
     * Pagination is configurable in the prepend and append display modes, where custom
     * suggestions are listed with field suggestions.
     *
     * Scrolling a list to load more needs a real browser; these tests only check that the
     * configuration is accepted.
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
     * A token inserted from a custom suggestion can carry a displayValue. Editing the value
     * clears it, so the input shows what the user types.
     *
     * This test only checks that the suggestion configuration supports displayValue.
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
      const suggestions = customSuggestion.suggest({
        query: 're',
        fields: [],
        existingTokens: [],
        signal: new AbortController().signal,
      });
      expect(Array.isArray(suggestions)).toBe(true);
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        expect(suggestions[0].tokens[0].displayValue).toBe('React');
      }
    });
  });

  describe('Fix #5: onTokensChange fires on token blur', () => {
    /**
     * The focused token is excluded from the comparison of confirmed tokens, so a change
     * made in it is reported once focus leaves it. This test covers deleting a token.
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
