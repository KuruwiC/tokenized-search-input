/**
 * Integration tests for editing existing tokens.
 * Tests user flows for modifying token values and operators.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { FieldDefinition } from '../../types';
import { basicFields } from '../fixtures';

const testFields = basicFields;

afterEach(() => {
  cleanup();
});

describe('Token Editing - User Journeys', () => {
  describe('Edit confirmed token', () => {
    it('enters edit mode on click', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} defaultValue="status:is:active" />);

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Click on the token to edit
      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      // Verify: Edit mode active
      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });
    });

    it('edits value and confirms with Enter', async () => {
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

      // Click to edit
      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Clear and enter new value
      const valueInput = screen.getByPlaceholderText('...');
      await user.clear(valueInput);
      await user.type(valueInput, 'inactive');
      await user.keyboard('{Enter}');

      // Verify: Value changed
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({ text: expect.stringContaining('status:is:inactive') })
        );
      });
    });
  });

  describe('Delete token', () => {
    it('deletes token with Backspace when empty', async () => {
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

      // Click to edit
      const token = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(token);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Clear value and press Backspace
      const valueInput = screen.getByPlaceholderText('...');
      await user.clear(valueInput);
      await user.keyboard('{Backspace}');

      // Verify: Token deleted
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: '' }));
      });
    });

    it('verifies single token remains after deleting first', async () => {
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

      // Click on status token to edit
      const statusToken = screen.getByRole('group', { name: /Filter: status/i });
      await user.click(statusToken);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Clear value and press Backspace to delete
      const valueInput = screen.getByPlaceholderText('...');
      await user.clear(valueInput);
      await user.keyboard('{Backspace}');

      // Verify: Only priority token remains
      await waitFor(() => {
        expect(screen.queryByRole('group', { name: /Filter: status/i })).not.toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
      });
    });
  });

  describe('Edit free text token', () => {
    it('displays loaded free text token correctly', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active searchterm"
          freeTextMode="tokenize"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Free text: searchterm/i })).toBeInTheDocument();
      });
    });
  });

  describe('Token validation', () => {
    it('validates token with custom validator on load', async () => {
      const fieldsWithValidation: FieldDefinition[] = [
        {
          key: 'email',
          label: 'Email',
          type: 'string',
          operators: ['is', 'contains'],
          validate: (value: string) => value.includes('@') || 'Must be a valid email',
        },
      ];

      render(
        <TokenizedSearchInput
          fields={fieldsWithValidation}
          defaultValue="email:is:valid@example.com"
        />
      );

      // Verify: Token loaded correctly with valid email
      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Filter: email/i })).toBeInTheDocument();
        expect(screen.getByText('valid@example.com')).toBeInTheDocument();
      });
    });
  });
});
