/**
 * Integration tests for FilterTokenView suggestion updates.
 * These tests verify that suggestion panel updates work correctly
 * after moving side effects from render to useEffect.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
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
});
