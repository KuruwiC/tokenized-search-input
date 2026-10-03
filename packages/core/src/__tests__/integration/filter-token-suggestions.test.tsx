/**
 * Integration tests for FilterTokenView suggestion updates.
 * Verifies that the suggestion panel follows token focus and edits.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { closeHistory } from '@tiptap/pm/history';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { getSuggestionState } from '../../plugins/suggestion';
import type { FieldDefinition } from '../../types';

const enumFields: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    category: 'Basic',
    operators: ['is', 'is_not'],
    enumValues: ['active', 'inactive', 'pending', 'archived'],
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    category: 'Basic',
    operators: ['is', 'is_not'],
    enumValues: ['critical', 'high', 'medium', 'low'],
  },
];

afterEach(() => {
  cleanup();
});

describe('FilterTokenView - Suggestion Updates', () => {
  describe('Enum field suggestions', () => {
    it('shows edit mode when focusing enum field token', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={enumFields} defaultValue="status:is:active" />);

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Click on the token to focus
      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      // Verify: Edit mode active (input visible)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });
    });

    it('selects suggestion with Enter key', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={enumFields} onChange={onChange} />);

      const editor = screen.getByRole('combobox');

      // Click editor to show field suggestions
      await user.click(editor);
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Select Status field
      await user.click(screen.getByText('Status'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Navigate down and select first enum value
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      // Verify: Value selected
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });
  });

  describe('Rapid value changes', () => {
    it('handles rapid typing without React update loop errors', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={enumFields} />);

      const editor = screen.getByRole('combobox');

      // Click editor to show field suggestions
      await user.click(editor);
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Select Status field
      await user.click(screen.getByText('Status'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Type rapidly
      const valueInput = screen.getByPlaceholderText('...');
      await user.type(valueInput, 'active');

      // Verify: No React update loop errors
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringMatching(/Maximum update depth exceeded/)
      );

      consoleError.mockRestore();
    });
  });

  describe('Multiple tokens', () => {
    it('handles switching between multiple enum tokens', async () => {
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={enumFields}
          defaultValue="status:is:active priority:is:high"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
      });

      // Click on status token
      const statusToken = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(statusToken);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Click on priority token
      const priorityToken = screen.getByRole('group', { name: /Filter: priority/i });
      await user.click(priorityToken);

      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('...').length).toBeGreaterThan(0);
      });
    });
  });
  describe('Value suggestions follow the token value', () => {
    const statusFields: FieldDefinition[] = [
      {
        key: 'status',
        label: 'Status',
        type: 'enum',
        operators: ['is'],
        enumValues: ['active', 'archived', 'pending', 'paused'],
      },
    ];

    async function openStatusSuggestions(defaultValue: string) {
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();
      render(<TokenizedSearchInput ref={ref} fields={statusFields} defaultValue={defaultValue} />);
      await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
      const editor = ref.current?.getEditor();
      if (!editor) throw new Error('editor not created');
      await user.click(screen.getByRole('group', { name: /Filter: status/i }));
      await screen.findByRole('listbox');
      return { user, ref, editor };
    }

    const optionNames = () =>
      screen
        .getAllByRole('option')
        .map((option) => option.textContent)
        .sort();

    it('shows the suggestions for the value that undo restores', async () => {
      const { user, ref, editor } = await openStatusSuggestions('status:is:p');

      await user.keyboard('a');
      expect(ref.current?.getValue()).toBe('status:is:pa');
      expect(optionNames()).toEqual(['paused']);
      act(() => {
        editor.view.dispatch(closeHistory(editor.state.tr));
      });

      await user.keyboard('{Control>}z{/Control}');
      expect(ref.current?.getValue()).toBe('status:is:p');
      expect(getSuggestionState(editor.state)?.query).toBe('p');
      await waitFor(() => expect(optionNames()).toEqual(['paused', 'pending']));
    });

    it('shows the suggestions for a value set through the ref', async () => {
      const { ref, editor } = await openStatusSuggestions('status:is:p');
      const [token] = (ref.current?.getSnapshot().segments ?? []).filter(
        (segment) => segment.type === 'filter'
      );
      if (token?.type !== 'filter') throw new Error('filter token not found');

      act(() => {
        ref.current?.updateToken(token.id, { value: 'ar' });
      });

      expect(getSuggestionState(editor.state)?.query).toBe('ar');
      await waitFor(() => expect(optionNames()).toEqual(['archived']));
    });
  });
});
