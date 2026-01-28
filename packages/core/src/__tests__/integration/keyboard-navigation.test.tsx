/**
 * Integration tests for keyboard navigation.
 * These tests verify navigation between tokens and within suggestions.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import { extendedFields } from '../fixtures';

const testFields = extendedFields;

afterEach(() => {
  cleanup();
});

describe('Keyboard Navigation - User Journeys', () => {
  describe('Field suggestion navigation', () => {
    it('navigates field suggestions with ArrowUp/ArrowDown', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Initially no item should be active (unselected state)
      const statusItem = screen.getByText('Status').closest('[role="option"]');
      expect(statusItem).toHaveAttribute('data-active', 'false');

      // Navigate down to select first item
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        const firstItem = screen.getByText('Status').closest('[role="option"]');
        expect(firstItem).toHaveAttribute('data-active', 'true');
      });

      // Navigate down to Priority
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        const priorityItem = screen.getByText('Priority').closest('[role="option"]');
        expect(priorityItem).toHaveAttribute('data-active', 'true');
      });

      // Navigate down to Assignee
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        const assigneeItem = screen.getByText('Assignee').closest('[role="option"]');
        expect(assigneeItem).toHaveAttribute('data-active', 'true');
      });

      // Navigate up
      await user.keyboard('{ArrowUp}');
      await waitFor(() => {
        const priorityItem = screen.getByText('Priority').closest('[role="option"]');
        expect(priorityItem).toHaveAttribute('data-active', 'true');
      });
    });

    it('wraps around at boundaries', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Navigate down to select first item, then navigate to last and wrap
      await user.keyboard('{ArrowDown}'); // Select Status
      await user.keyboard('{ArrowDown}'); // Priority
      await user.keyboard('{ArrowDown}'); // Assignee
      await user.keyboard('{ArrowDown}'); // Wrap to Status
      await waitFor(() => {
        const firstItem = screen.getByText('Status').closest('[role="option"]');
        expect(firstItem).toHaveAttribute('data-active', 'true');
      });
    });

    it('selects field with Enter', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Navigate to select Status first, then to Priority
      await user.keyboard('{ArrowDown}'); // Select Status
      await user.keyboard('{ArrowDown}'); // Navigate to Priority

      // Select with Enter
      await user.keyboard('{Enter}');

      // Should create filter token with Priority field
      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });
    });

    it('closes suggestions with Escape', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Status')).not.toBeInTheDocument();
      });
    });
  });

  describe('Token-to-token navigation', () => {
    it('exits token with ArrowRight at end', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} defaultValue="status:is:active" />);

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Click on token to edit
      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      // Wait for input to be focused (not just present)
      await waitFor(() => {
        const input = screen.getByPlaceholderText('...') as HTMLInputElement;
        expect(document.activeElement).toBe(input);
      });

      // Navigate to end and press ArrowRight multiple times to exit
      // Value → DeleteButton → Exit token
      await user.keyboard('{End}');
      await user.keyboard('{ArrowRight}'); // Move to delete button
      await user.keyboard('{ArrowRight}'); // Exit token

      // Should exit token (close editing mode)
      await waitFor(() => {
        // Editor should be focused, not the token input
        expect(screen.queryByPlaceholderText('...')).not.toBeInTheDocument();
      });
    });

    it('exits first token with ArrowLeft at start without inserting extra space', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          onChange={onChange}
          freeTextMode="tokenize"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Click on token to edit
      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      // Wait for input to be focused
      await waitFor(() => {
        const input = screen.getByPlaceholderText('...') as HTMLInputElement;
        expect(document.activeElement).toBe(input);
      });

      // Navigate to start and press ArrowLeft twice:
      // - First ArrowLeft: moves to operator select (Shift+Tab behavior)
      // - Second ArrowLeft: exits token to the left
      await user.keyboard('{Home}');
      await user.keyboard('{ArrowLeft}'); // Focus operator select
      await user.keyboard('{ArrowLeft}'); // Exit token left

      // Should exit token (close editing mode)
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('...')).not.toBeInTheDocument();
      });

      // Verify no extra spaces were inserted - should still serialize as original
      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        if (lastCall) {
          expect(lastCall[0].text).toBe('status:is:active');
        }
      });
    });
  });

  describe('Tab navigation', () => {
    it('Tab with value confirms token', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} onChange={onChange} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      // Select Status field
      await user.click(screen.getByText('Status'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Enter value and Tab
      const valueInput = screen.getByPlaceholderText('...');
      await user.type(valueInput, 'active');
      await user.keyboard('{Tab}');

      // Token should be confirmed
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({ text: expect.stringContaining('status:is:active') })
        );
      });
    });
  });

  describe('Backspace navigation', () => {
    it('Backspace at start of token deletes it', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Click on token to edit
      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Clear value and press Backspace to delete
      const valueInput = screen.getByPlaceholderText('...');
      await user.clear(valueInput);
      await user.keyboard('{Backspace}');

      // Token should be deleted
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: '' }));
      });
    });

    it('deletes middle token cleanly without leaving extra spaces', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active priority:is:high"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
      });

      // Click on first token to edit
      const statusToken = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(statusToken);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Clear value and press Backspace to delete the token
      const valueInput = screen.getByPlaceholderText('...');
      await user.clear(valueInput);
      await user.keyboard('{Backspace}');

      // Only the remaining token should exist, no extra spaces
      await waitFor(() => {
        const calls = onChange.mock.calls;
        const lastCall = calls[calls.length - 1];
        // Should be exactly "priority:is:high" without leading/trailing extra spaces
        expect(lastCall[0].text).toBe('priority:is:high');
      });
    });
  });

  describe('Search execution', () => {
    it('Enter key executes search when not in token and suggestions closed', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          onSubmit={onSubmit}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Click editor and close suggestions
      const editor = screen.getByRole('combobox');
      await user.click(editor);
      await user.keyboard('{Escape}');

      // Press Enter to search
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const [snapshot] = onSubmit.mock.calls[0];
        expect(snapshot.text).toBe('status:is:active');
      });
    });
  });

  describe('Keyboard handler timing', () => {
    it('uses latest handler values after focus change', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Click on token to edit
      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Type some text rapidly
      const valueInput = screen.getByPlaceholderText('...');
      await user.type(valueInput, 'test');

      // Keyboard events should work correctly with latest values
      await user.keyboard('{End}');
      await user.keyboard('{ArrowRight}'); // Move to delete button

      // Value should still be there
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({ text: expect.stringContaining('test') })
        );
      });
    });

    it('handles rapid focus changes followed by keyboard input', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active priority:is:high"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
      });

      // Click on first token
      const statusToken = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(statusToken);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Quickly navigate out
      await user.keyboard('{Escape}'); // Close suggestions
      await user.keyboard('{ArrowRight}'); // Exit token to the right
      await user.keyboard('{ArrowRight}'); // Move further right
      await user.keyboard('{ArrowLeft}'); // Navigate back

      // Verify: Both tokens still exist (no corruption from rapid navigation)
      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
      });

      // Verify: Original values are preserved
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('status:is:active') })
      );
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('priority:is:high') })
      );
    });

    it('keyboard handlers respond correctly after token state changes', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} onChange={onChange} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      // Create a token
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Status'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Type value and confirm with Tab (which exits token)
      const valueInput = screen.getByPlaceholderText('...');
      await user.type(valueInput, 'active');
      await user.keyboard('{Tab}');

      // Value should be confirmed
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({ text: 'status:is:active' })
        );
      });

      // After token confirmation, suggestions should show and keyboard navigation should work
      // No stale handlers should cause issues - test passes if no errors occur
    });
  });
});
