/**
 * Integration tests for keyboard navigation.
 * These tests verify navigation between tokens and within suggestions.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
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
        const token = screen.getByRole('group', { name: /^Filter: priority / });
        expect(within(token).getByPlaceholderText('...')).toBeInTheDocument();
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
      const ref = createRef<TokenizedSearchInputRef>();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
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
      expect(ref.current?.getValue()).toBe('status:is:active');
      // getValue trims the edges of the query, so a space before the token shows only in the document
      expect(ref.current?.getEditor()?.state.doc.textContent).toBe('');
    });
  });

  describe('Backspace navigation', () => {
    it('deleting the first token with Backspace leaves the rest without extra spaces', async () => {
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

  describe('Keyboard handler timing', () => {
    it('reports the typed value on every keystroke and moves focus to the token delete button on ArrowRight at the end', async () => {
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
        expect(onChange).toHaveBeenLastCalledWith(
          expect.objectContaining({ text: 'status:is:activetest' })
        );
      });
      expect(document.activeElement).toBe(document.querySelector('.tsi-token-delete'));
    });

    it('ArrowRight leaves a token for the editor without changing the query', async () => {
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
        expect(document.activeElement).toBe(document.querySelector('.ProseMirror'));
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ text: 'status:is:active priority:is:high' })
      );
    });

    it('Tab with value confirms token', async () => {
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
