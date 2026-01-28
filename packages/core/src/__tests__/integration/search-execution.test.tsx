/**
 * Integration tests for search execution behavior.
 * Tests the onSubmit callback and query serialization when search is triggered.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import { extendedFields } from '../fixtures';

afterEach(() => {
  cleanup();
});

describe('Search Execution', () => {
  it('triggers onSubmit when Enter is pressed', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <TokenizedSearchInput
        fields={extendedFields}
        defaultValue="status:is:active"
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    const editor = screen.getByRole('combobox');
    await user.click(editor);

    // Close the field suggestion dropdown first
    await user.keyboard('{Escape}');

    // Ensure suggestion is closed
    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: /filter fields/i })).not.toBeInTheDocument();
    });

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const [snapshot] = onSubmit.mock.calls[0];
      expect(snapshot.text).toBe('status:is:active');
      expect(snapshot.segments).toHaveLength(1);
      expect(snapshot.segments[0]).toMatchObject({
        type: 'filter',
        key: 'status',
        operator: 'is',
        value: 'active',
      });
    });
  });
});
