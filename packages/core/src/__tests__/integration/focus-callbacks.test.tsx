/**
 * Integration tests for focus-related callbacks.
 * Tests onBlur, onFocus, and onClear callback behaviors.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import { extendedFields } from '../fixtures';

afterEach(() => {
  cleanup();
});

describe('Focus Callbacks', () => {
  describe('onFocus', () => {
    it('triggers onFocus when input receives focus', async () => {
      const onFocus = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={extendedFields}
          defaultValue="status:is:active"
          onFocus={onFocus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      await waitFor(() => {
        expect(onFocus).toHaveBeenCalled();
        const [snapshot] = onFocus.mock.calls[0];
        expect(snapshot.text).toBe('status:is:active');
        expect(snapshot.segments).toHaveLength(1);
      });
    });

    it('provides snapshot with current content on focus', async () => {
      const onFocus = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={extendedFields}
          defaultValue="status:is:active priority:is:high"
          onFocus={onFocus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      await waitFor(() => {
        expect(onFocus).toHaveBeenCalled();
        const [snapshot] = onFocus.mock.calls[0];
        expect(snapshot.segments).toHaveLength(2);
      });
    });
  });

  describe('onBlur', () => {
    it('triggers onBlur when focus leaves the input', async () => {
      const onBlur = vi.fn();
      const user = userEvent.setup();
      render(
        <div>
          <TokenizedSearchInput
            fields={extendedFields}
            defaultValue="status:is:active"
            onBlur={onBlur}
          />
          <button type="button">Other Element</button>
        </div>
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      // Close any suggestion dropdown first
      await user.keyboard('{Escape}');

      // Click outside to trigger blur
      await user.click(screen.getByRole('button', { name: 'Other Element' }));

      await waitFor(() => {
        expect(onBlur).toHaveBeenCalled();
        const [snapshot] = onBlur.mock.calls[0];
        expect(snapshot.text).toBe('status:is:active');
      });
    });

    it('provides snapshot with current content on blur', async () => {
      const onBlur = vi.fn();
      const user = userEvent.setup();
      render(
        <div>
          <TokenizedSearchInput
            fields={extendedFields}
            defaultValue="status:is:active"
            onBlur={onBlur}
          />
          <button type="button">Other Element</button>
        </div>
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      const editor = screen.getByRole('combobox');
      await user.click(editor);
      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('button', { name: 'Other Element' }));

      await waitFor(() => {
        expect(onBlur).toHaveBeenCalled();
        const [snapshot] = onBlur.mock.calls[0];
        expect(snapshot.segments).toHaveLength(1);
        expect(snapshot.segments[0]).toMatchObject({
          type: 'filter',
          key: 'status',
          operator: 'is',
          value: 'active',
        });
      });
    });

    it('triggers onBlur after selecting enum value and clicking outside', async () => {
      const onBlur = vi.fn();
      const user = userEvent.setup();
      render(
        <div>
          <TokenizedSearchInput fields={extendedFields} onBlur={onBlur} />
          <button type="button">Other Element</button>
        </div>
      );

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      // Type field name and select from suggestions
      await user.keyboard('status');
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Status'));

      // Wait for value suggestions to appear and select one
      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
      });
      await user.click(screen.getByText('active'));

      // Close any remaining suggestion dropdown
      await user.keyboard('{Escape}');

      // Click outside to blur
      await user.click(screen.getByRole('button', { name: 'Other Element' }));

      // onBlur should be called
      await waitFor(() => {
        expect(onBlur).toHaveBeenCalled();
        const [snapshot] = onBlur.mock.calls[onBlur.mock.calls.length - 1];
        expect(snapshot.text).toContain('status:is:active');
      });
    });

    it('triggers onBlur after multiple suggestion selections and clicking outside', async () => {
      const onBlur = vi.fn();
      const user = userEvent.setup();
      render(
        <div>
          <TokenizedSearchInput fields={extendedFields} onBlur={onBlur} />
          <button type="button">Other Element</button>
        </div>
      );

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      // Type and select first field
      await user.keyboard('status');
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Status'));

      // Select value
      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
      });
      await user.click(screen.getByText('active'));

      // Close suggestions and blur
      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('button', { name: 'Other Element' }));

      await waitFor(() => {
        expect(onBlur).toHaveBeenCalled();
      });
    });
  });

  describe('onClear', () => {
    it('triggers onClear when clear button is clicked', async () => {
      const onClear = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={extendedFields}
          defaultValue="status:is:active"
          clearable
          onClear={onClear}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('clears content and calls onClear', async () => {
      const onClear = vi.fn();
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={extendedFields}
          defaultValue="status:is:active"
          clearable
          onClear={onClear}
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(onClear).toHaveBeenCalled();

      // Content should be cleared (onChange should fire with empty content)
      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0].text).toBe('');
      });
    });
  });
});
