/**
 * Integration tests for clipboard operations.
 * These tests verify copy/paste behavior.
 *
 * Note: Full clipboard testing requires browser environment.
 * These tests verify the serialization/parsing through the value prop.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import { fieldsWithDotNotation } from '../fixtures';

const testFields = fieldsWithDotNotation;

afterEach(() => {
  cleanup();
});

describe('Clipboard Operations - Serialization/Parsing', () => {
  describe('Load from serialized value (simulates paste)', () => {
    it('loads single filter token', async () => {
      render(<TokenizedSearchInput fields={testFields} defaultValue="status:is:active" />);

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('is')).toBeInTheDocument();
        expect(screen.getByText('active')).toBeInTheDocument();
      });
    });

    it('loads multiple filter tokens', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active priority:is:high"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
      });
    });

    it('loads filter token with is_not operator', async () => {
      render(<TokenizedSearchInput fields={testFields} defaultValue="status:is_not:inactive" />);

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('is not')).toBeInTheDocument();
        expect(screen.getByText('inactive')).toBeInTheDocument();
      });
    });

    it('loads filter token with contains operator', async () => {
      render(
        <TokenizedSearchInput fields={testFields} defaultValue="user.email:contains:@example.com" />
      );

      await waitFor(() => {
        expect(screen.getByText('User Email')).toBeInTheDocument();
        expect(screen.getByText('contains')).toBeInTheDocument();
        expect(screen.getByText('@example.com')).toBeInTheDocument();
      });
    });

    it('loads filter token with comma in value', async () => {
      render(<TokenizedSearchInput fields={testFields} defaultValue="status:is:active,pending" />);

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
        // Comma-containing value is treated as single string
        expect(screen.getByText('active,pending')).toBeInTheDocument();
      });
    });

    it('loads free text tokens in tokenize mode', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue='status:is:active "search term"'
          freeTextMode="tokenize"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Free text: search term/i })).toBeInTheDocument();
      });
    });

    it('loads mixed filter and free text tokens', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active keyword priority:is:high"
          freeTextMode="tokenize"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Free text: keyword/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
      });
    });
  });

  describe('Serialize tokens (simulates copy)', () => {
    it('serializes single token correctly', async () => {
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

      // Edit token: change value to trigger onChange
      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Clear and type new value to trigger change
      const valueInput = screen.getByPlaceholderText('...');
      await user.clear(valueInput);
      await user.type(valueInput, 'inactive');
      await user.keyboard('{Enter}');

      // Check serialized output with new value
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({ text: 'status:is:inactive' })
        );
      });
    });
  });

  describe('Plain mode loading', () => {
    it('loads filter tokens as token nodes in plain mode', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active freetext priority:is:high"
          freeTextMode="plain"
        />
      );

      await waitFor(() => {
        // Filter tokens should be rendered as token nodes
        expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
      });
    });

    it('loads filter tokens as token nodes in none mode', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active freetext priority:is:high"
          freeTextMode="none"
        />
      );

      await waitFor(() => {
        // Filter tokens should be rendered as token nodes
        expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
        // Free text should be ignored in none mode
        expect(screen.queryByText('freetext')).not.toBeInTheDocument();
      });
    });
  });

  describe('Round-trip (parse -> modify -> serialize)', () => {
    it('preserves token data through edit cycle', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const initialValue = 'status:is:active priority:is:high';
      render(
        <TokenizedSearchInput fields={testFields} defaultValue={initialValue} onChange={onChange} />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
      });

      // Edit status token
      const statusToken = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(statusToken);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Change value
      const valueInput = screen.getByPlaceholderText('...');
      await user.clear(valueInput);
      await user.type(valueInput, 'inactive');
      await user.keyboard('{Enter}');

      // Verify only the edited token changed
      await waitFor(() => {
        const snapshot = onChange.mock.calls[onChange.mock.calls.length - 1][0];
        expect(snapshot.text).toContain('status:is:inactive');
        expect(snapshot.text).toContain('priority:is:high');
      });
    });

    it('handles complex query with all token types', async () => {
      const onSubmit = vi.fn();
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue='status:is:active "search term" priority:is_not:low keyword'
          freeTextMode="tokenize"
          onSubmit={onSubmit}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Free text: search term/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Free text: keyword/i })).toBeInTheDocument();
      });
    });
  });
});
