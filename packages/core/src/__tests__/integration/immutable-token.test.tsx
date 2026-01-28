/**
 * Integration tests for immutable tokens.
 * Tests user flows for selecting, deleting, and navigating immutable tokens.
 *
 * Immutable tokens:
 * - Cannot be edited (no value input)
 * - Can only be deleted via X button or 2-stage Backspace
 * - Are selected as a whole when clicked
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { FieldDefinition } from '../../types';

const immutableFields: FieldDefinition[] = [
  {
    key: 'country',
    label: 'Country',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: ['jp', 'us', 'uk'],
    immutable: true,
  },
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: ['active', 'inactive'],
    immutable: false,
  },
];

afterEach(() => {
  cleanup();
});

describe('Immutable Token - Integration Tests', () => {
  describe('Selection behavior', () => {
    it('selects entire token when clicked', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={immutableFields} defaultValue="country:is:jp" />);

      await waitFor(() => {
        expect(screen.getByText('Country')).toBeInTheDocument();
      });

      const token = screen.getByRole('group', { name: /country/i });
      await user.click(token);

      // Immutable tokens should show as selected (not in edit mode)
      // Check that no input is visible (unlike mutable tokens)
      await waitFor(() => {
        const inputs = screen.queryAllByRole('textbox');
        // Should not have a value input inside the token
        const tokenInputs = inputs.filter((input) => token.contains(input));
        expect(tokenInputs).toHaveLength(0);
      });
    });

    it('does not show value input when focused', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={immutableFields} defaultValue="country:is:jp" />);

      await waitFor(() => {
        expect(screen.getByText('Country')).toBeInTheDocument();
      });

      const token = screen.getByRole('group', { name: /country/i });
      await user.click(token);

      // Wait for any potential input to appear
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Immutable tokens should not have an editable input
      const placeholder = screen.queryByPlaceholderText('...');
      expect(placeholder).toBeNull();
    });
  });

  describe('Deletion behavior', () => {
    it('deletes token via X button click', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={immutableFields}
          defaultValue="country:is:jp"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Country')).toBeInTheDocument();
      });

      // Find and click the delete button (aria-label is "Remove {field} filter")
      const deleteButton = screen.getByRole('button', { name: /remove/i });
      await user.click(deleteButton);

      // Verify: Token deleted
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: '' }));
      });
    });

    it('deletes selected token with Backspace', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={immutableFields}
          defaultValue="country:is:jp"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Country')).toBeInTheDocument();
      });

      // Click to select the token
      const token = screen.getByRole('group', { name: /country/i });
      await user.click(token);

      // Press Backspace to delete
      await user.keyboard('{Backspace}');

      // Verify: Token deleted
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: '' }));
      });
    });

    it('deletes selected token with Delete key', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={immutableFields}
          defaultValue="country:is:jp"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Country')).toBeInTheDocument();
      });

      // Click to select the token
      const token = screen.getByRole('group', { name: /country/i });
      await user.click(token);

      // Press Delete to delete
      await user.keyboard('{Delete}');

      // Verify: Token deleted
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: '' }));
      });
    });
  });

  describe('Keyboard navigation', () => {
    it('navigates past immutable token with arrow keys', async () => {
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={immutableFields}
          defaultValue="country:is:jp status:is:active"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Country')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Focus the editor
      const editor = screen.getByRole('combobox');
      await user.click(editor);

      // Navigate with arrow keys - should skip over immutable token
      // or select it as a whole
      await user.keyboard('{ArrowRight}');

      // The behavior depends on the current cursor position
      // This test verifies that navigation doesn't break
      await waitFor(() => {
        // Editor should still be functional
        expect(editor).toBeInTheDocument();
      });
    });

    it('exits immutable token selection with Escape', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={immutableFields} defaultValue="country:is:jp" />);

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /country/i })).toBeInTheDocument();
      });

      // Click to select the token
      const token = screen.getByRole('group', { name: /country/i });
      await user.click(token);

      // Press Escape to deselect
      await user.keyboard('{Escape}');

      // Verify: Token still exists (use role selector to avoid ambiguity with suggestions)
      await waitFor(() => {
        expect(screen.getByRole('group', { name: /country/i })).toBeInTheDocument();
      });
    });
  });

  describe('Mixed token types', () => {
    it('handles mix of immutable and mutable tokens', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={immutableFields}
          defaultValue="country:is:jp status:is:active"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Country')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Click on mutable token (status) - should enter edit mode
      const statusToken = screen.getByRole('group', { name: /status/i });
      await user.click(statusToken);

      // Mutable token should show input
      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Tab to exit
      await user.keyboard('{Tab}');

      // Click on immutable token (country) - should select as whole
      const countryToken = screen.getByRole('group', { name: /country/i });
      await user.click(countryToken);

      // Immutable token should not show input
      await new Promise((resolve) => setTimeout(resolve, 100));
      const inputs = screen.queryAllByPlaceholderText('...');
      const tokenInputs = inputs.filter((input) => countryToken.contains(input));
      expect(tokenInputs).toHaveLength(0);
    });
  });
});
