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
    it('selects entire token without showing value input when clicked', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={immutableFields} defaultValue="country:is:jp" />);

      await waitFor(() => {
        expect(screen.getByText('Country')).toBeInTheDocument();
      });

      const token = screen.getByRole('group', { name: /country/i });
      await user.click(token);

      await waitFor(() => {
        const inputs = screen.queryAllByRole('textbox');
        const tokenInputs = inputs.filter((input) => token.contains(input));
        expect(tokenInputs).toHaveLength(0);
      });
      expect(screen.queryByPlaceholderText('...')).toBeNull();
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

      const deleteButton = screen.getByRole('button', { name: /remove/i });
      await user.click(deleteButton);
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

      const token = screen.getByRole('group', { name: /country/i });
      await user.click(token);
      await user.keyboard('{Backspace}');
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

      const token = screen.getByRole('group', { name: /country/i });
      await user.click(token);
      await user.keyboard('{Delete}');
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

      const editor = screen.getByRole('combobox');
      await user.click(editor);
      await user.keyboard('{ArrowRight}');

      await waitFor(() => {
        expect(editor).toBeInTheDocument();
      });
    });

    it('exits immutable token selection with Escape', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={immutableFields} defaultValue="country:is:jp" />);

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /country/i })).toBeInTheDocument();
      });

      const token = screen.getByRole('group', { name: /country/i });
      await user.click(token);
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.getByRole('group', { name: /country/i })).toBeInTheDocument();
      });
    });
  });

  describe('Immutable confirmation on blur', () => {
    it('creates editable token from immutable field via colon trigger', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={immutableFields} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      await user.keyboard('country:');

      await waitFor(() => {
        expect(screen.getByText('Country')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });
    });

    it('allows value input while token is focused', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={immutableFields} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      await user.keyboard('country:');

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      await user.keyboard('jp');
      await waitFor(() => {
        const input = screen.getByPlaceholderText('...');
        expect(input).toHaveValue('jp');
      });
    });

    it('becomes immutable after blur with value', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={immutableFields} onChange={onChange} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      await user.keyboard('country:');

      await waitFor(() => {
        expect(screen.getByText('Country')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      await user.keyboard('jp');

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toHaveValue('jp');
      });

      await user.keyboard('{Tab}');

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });

      const token = screen.getByRole('group', { name: /country/i });
      await user.click(token);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const tokenInputs = screen
        .queryAllByPlaceholderText('...')
        .filter((input) => token.contains(input));
      expect(tokenInputs).toHaveLength(0);
    });

    it('allows editing when mutable token label is changed to immutable field', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={immutableFields} defaultValue="status:is:active" />);

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /status/i })).toBeInTheDocument();
      });

      const token = screen.getByRole('group', { name: /status/i });
      await user.click(token);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      const labelButton = screen.getByRole('button', { name: 'Select field' });
      await user.click(labelButton);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /country/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('option', { name: /country/i }));

      // Token remains editable during edit mode even after field change
      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      await user.keyboard('{Tab}');
      await new Promise((resolve) => setTimeout(resolve, 100));

      // After blur, token becomes immutable
      const updatedToken = screen.getByRole('group', { name: /country/i });
      await user.click(updatedToken);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const tokenInputs = screen
        .queryAllByPlaceholderText('...')
        .filter((input) => updatedToken.contains(input));
      expect(tokenInputs).toHaveLength(0);
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

      const statusToken = screen.getByRole('group', { name: /status/i });
      await user.click(statusToken);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      await user.keyboard('{Tab}');

      const countryToken = screen.getByRole('group', { name: /country/i });
      await user.click(countryToken);

      await new Promise((resolve) => setTimeout(resolve, 100));
      const inputs = screen.queryAllByPlaceholderText('...');
      const tokenInputs = inputs.filter((input) => countryToken.contains(input));
      expect(tokenInputs).toHaveLength(0);
    });
  });
});
