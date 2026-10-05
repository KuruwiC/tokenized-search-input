/**
 * Integration tests for editing existing tokens.
 * Tests user flows for modifying token values and operators.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { FieldDefinition } from '../../types';
import { basicFields } from '../fixtures';
import { renderInput } from '../helpers/token-blocks';

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

  describe('Value input', () => {
    async function editValue(query: string, group: RegExp) {
      const user = userEvent.setup();
      const rendered = await renderInput(query);
      await user.click(screen.getByRole('group', { name: group }));
      const input = await screen.findByPlaceholderText<HTMLInputElement>('...');
      expect(input).toHaveFocus();
      return { user, input, ...rendered };
    }

    it('removes the character after the caret on each Delete and the token once the value is empty', async () => {
      const { user, input, ref } = await editValue('assignee:is:bob', /assignee/i);
      input.setSelectionRange(0, 0);

      for (const expected of ['ob', 'b', '']) {
        await user.keyboard('{Delete}');
        expect(input).toHaveFocus();
        expect(input.value).toBe(expected);
        expect(input.selectionStart).toBe(0);
      }

      await user.keyboard('{Delete}');
      expect(ref.current?.getValue()).toBe('');
    });

    it('keeps the caret where it is while typing inside the value', async () => {
      const { user, input, ref } = await editValue('assignee:is:bob', /assignee/i);
      input.setSelectionRange(1, 1);

      await user.keyboard('xy');
      expect(input.value).toBe('bxyob');
      expect(input.selectionStart).toBe(3);
      expect(ref.current?.getValue()).toBe('assignee:is:bxyob');
    });

    it('shows the value the document keeps when an edit does not change it', async () => {
      const { user, input, ref } = await editValue('status:is:active', /status/i);
      input.setSelectionRange(0, 1);

      // An enum value is stored in its own case, so this edit leaves the token as it is
      await user.keyboard('A');
      expect(ref.current?.getValue()).toBe('status:is:active');
      expect(input.value).toBe('active');
    });

    it('keeps the caret where it is while typing inside a free text value', async () => {
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          freeTextMode="tokenize"
          defaultValue="hello"
        />
      );
      await user.click(await screen.findByRole('group', { name: /Free text/i }));
      const input = await screen.findByLabelText<HTMLInputElement>('Free text value');
      input.setSelectionRange(2, 2);

      await user.keyboard('xy');
      expect(input.value).toBe('hexyllo');
      expect(input.selectionStart).toBe(4);
      expect(ref.current?.getValue()).toBe('hexyllo');
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
