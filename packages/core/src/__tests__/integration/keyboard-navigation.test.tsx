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

      const statusItem = screen.getByText('Status').closest('[role="option"]');
      expect(statusItem).toHaveAttribute('data-active', 'false');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        const firstItem = screen.getByText('Status').closest('[role="option"]');
        expect(firstItem).toHaveAttribute('data-active', 'true');
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        const priorityItem = screen.getByText('Priority').closest('[role="option"]');
        expect(priorityItem).toHaveAttribute('data-active', 'true');
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        const assigneeItem = screen.getByText('Assignee').closest('[role="option"]');
        expect(assigneeItem).toHaveAttribute('data-active', 'true');
      });

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

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
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

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
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

      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('...') as HTMLInputElement;
        expect(document.activeElement).toBe(input);
      });

      await user.keyboard('{End}');
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowRight}');
      await waitFor(() => {
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

      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('...') as HTMLInputElement;
        expect(document.activeElement).toBe(input);
      });

      await user.keyboard('{Home}');
      await user.keyboard('{ArrowLeft}');
      await user.keyboard('{ArrowLeft}');
      await user.keyboard('{ArrowLeft}');

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('...')).not.toBeInTheDocument();
      });
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

      await user.click(screen.getByText('Status'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      const valueInput = screen.getByPlaceholderText('...');
      await user.type(valueInput, 'active');
      await user.keyboard('{Tab}');
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

      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      const valueInput = screen.getByPlaceholderText('...');
      await user.clear(valueInput);
      await user.keyboard('{Backspace}');
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

      const statusToken = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(statusToken);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      const valueInput = screen.getByPlaceholderText('...');
      await user.clear(valueInput);
      await user.keyboard('{Backspace}');

      await waitFor(() => {
        const calls = onChange.mock.calls;
        const lastCall = calls[calls.length - 1];
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

      const editor = screen.getByRole('combobox');
      await user.click(editor);
      await user.keyboard('{Escape}');
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

      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      const valueInput = screen.getByPlaceholderText('...');
      await user.type(valueInput, 'test');
      await user.keyboard('{End}');
      await user.keyboard('{ArrowRight}');
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

      const statusToken = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(statusToken);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowLeft}');

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
      });
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

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Status'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      const valueInput = screen.getByPlaceholderText('...');
      await user.type(valueInput, 'active');
      await user.keyboard('{Tab}');

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({ text: 'status:is:active' })
        );
      });
    });
  });
});
