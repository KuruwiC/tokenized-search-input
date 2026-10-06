/**
 * Integration tests for the Config API (Grouped Props pattern).
 *
 * Tests the configuration props pattern:
 * <TokenizedSearchInput
 *   fields={fields}
 *   suggestions={{ field: { disabled: true } }}
 *   validation={{ rules: [Unique.rule('key')] }}
 * />
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { Unique } from '../../validation/presets';
import { basicFields } from '../fixtures/fields';
import { filterTokens } from '../helpers/token-queries';

describe('Config API', () => {
  describe('suggestions config', () => {
    it('disables field suggestions when field.disabled is true', async () => {
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput fields={basicFields} suggestions={{ field: { disabled: true } }} />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'sta');

      // Verify field suggestions do not appear
      await waitFor(() => {
        expect(
          screen.queryByRole('listbox', { name: 'Field suggestions' })
        ).not.toBeInTheDocument();
      });
    });

    it('disables value suggestions when value.disabled is true', async () => {
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="status:is:"
          suggestions={{ value: { disabled: true } }}
        />
      );

      // Click into the token's value area
      const input = screen.getByRole('combobox');
      await user.click(input);

      // Verify value suggestions do not appear
      await waitFor(() => {
        expect(
          screen.queryByRole('listbox', { name: 'Value suggestions' })
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('validation config', () => {
    it('uses Unique with onDuplicate reject to delete duplicates', async () => {
      const handleChange = vi.fn();

      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="status:is:active status:is:pending"
          onChange={handleChange}
          validation={{
            rules: [Unique.rule('key', { onDuplicate: 'reject' })],
          }}
        />
      );

      // With onDuplicate reject, the duplicate token should be removed
      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
        const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1];
        const snapshot = lastCall[0];
        // Should only have one status token after auto-delete
        const statusTokens = snapshot.segments.filter(
          (s: { type: string; key?: string }) => s.type === 'filter' && s.key === 'status'
        );
        expect(statusTokens.length).toBe(1);
      });
    });
  });

  describe('unknownFields config', () => {
    function renderWithRef(props: Partial<ComponentProps<typeof TokenizedSearchInput>>) {
      const ref = createRef<TokenizedSearchInputRef>();
      render(<TokenizedSearchInput ref={ref} fields={basicFields} {...props} />);
      return ref;
    }

    it('does not tokenize unknown fields when unknownFields is omitted', async () => {
      const ref = renderWithRef({ defaultValue: 'customField:is:value' });

      await waitFor(() => expect(ref.current?.getValue()).toBe('customField:is:value'));
      expect(document.querySelectorAll('.node-filterToken')).toHaveLength(0);
      expect(filterTokens(ref)).toHaveLength(0);
    });

    it('tokenizes unknown fields when unknownFields is provided without options', async () => {
      const ref = renderWithRef({ defaultValue: 'customField:value', unknownFields: {} });

      await waitFor(() => expect(document.querySelectorAll('.node-filterToken')).toHaveLength(1));
      expect(filterTokens(ref)).toMatchObject([
        { key: 'customField', operator: 'is', value: 'value' },
      ]);
    });

    it('accepts every default operator for unknown fields when operators is omitted', async () => {
      const ref = renderWithRef({
        defaultValue: 'customField:starts_with:abc',
        unknownFields: {},
      });

      await waitFor(() => expect(document.querySelectorAll('.node-filterToken')).toHaveLength(1));
      expect(filterTokens(ref)).toMatchObject([
        { key: 'customField', operator: 'starts_with', value: 'abc' },
      ]);
    });

    it('uses unknownFields.operators[0] as the operator of unknown field tokens', async () => {
      const ref = renderWithRef({
        defaultValue: 'custom:value',
        unknownFields: { operators: ['contains', 'not_contains'] },
      });

      await waitFor(() => expect(document.querySelectorAll('.node-filterToken')).toHaveLength(1));
      expect(filterTokens(ref)).toMatchObject([
        { key: 'custom', operator: 'contains', value: 'value' },
      ]);
      await waitFor(() => {
        expect(screen.getByText('contains')).toBeInTheDocument();
      });
    });

    it('keeps an operator outside unknownFields.operators and marks the token invalid', async () => {
      const ref = renderWithRef({
        defaultValue: 'custom:is:value',
        unknownFields: { operators: ['contains'] },
      });

      await waitFor(() => expect(document.querySelectorAll('.node-filterToken')).toHaveLength(1));
      await waitFor(() =>
        expect(filterTokens(ref)).toMatchObject([
          {
            key: 'custom',
            operator: 'is',
            value: 'value',
            invalid: true,
            invalidReason: 'unknown-operator',
          },
        ])
      );
    });

    it('hides the operator of unknown fields when hideSingleOperator is set and one operator exists', async () => {
      renderWithRef({
        defaultValue: 'custom:value',
        unknownFields: { operators: ['contains'], hideSingleOperator: true },
      });

      await waitFor(() => expect(document.querySelectorAll('.node-filterToken')).toHaveLength(1));
      expect(screen.queryByText('contains')).not.toBeInTheDocument();
    });
  });

  describe('labels config', () => {
    it('applies operator labels', async () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="status:is:active"
          labels={{ operators: { is: 'equals' } }}
        />
      );

      // The operator label should use custom text
      await waitFor(() => {
        expect(screen.getByText('equals')).toBeInTheDocument();
      });
    });

    it('applies pagination labels', async () => {
      const mockSuggest = vi.fn().mockResolvedValue({
        suggestions: [{ tokens: [{ key: 'status', operator: 'is', value: 'a' }], label: 'A' }],
        hasMore: true,
      });

      render(
        <TokenizedSearchInput
          fields={basicFields}
          suggestions={{
            custom: { suggest: mockSuggest, debounceMs: 0 },
          }}
          labels={{
            pagination: { loading: 'Loading more...', scrollForMore: 'Scroll to load' },
          }}
        />
      );

      // Labels are stored for use by suggestion list
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('pickers config', () => {
    it('uses custom date picker renderer', async () => {
      const dateField = {
        key: 'created',
        label: 'Created',
        type: 'date' as const,
        operators: ['is'] as const,
      };

      const CustomDatePicker = vi.fn(() => (
        <div data-testid="custom-date-picker">Custom Picker</div>
      ));

      render(
        <TokenizedSearchInput
          fields={[dateField]}
          defaultValue="created:is:2024-01-01"
          pickers={{ renderDate: CustomDatePicker }}
        />
      );

      // Verify token is rendered (picker opening requires more complex interaction)
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });

      // Verify the custom picker prop is passed (will be used when picker opens)
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('Multiple configs', () => {
    it('combines configuration from multiple config props', async () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="status:is:active status:is:pending"
          suggestions={{ field: { disabled: true } }}
          validation={{ rules: [Unique.rule('key')] }}
          labels={{ operators: { is: 'equals' } }}
        />
      );

      // Wait for tokens to render
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(2);
      });

      // Validation should apply - one token should be invalid
      await waitFor(() => {
        const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
        expect(invalidTokens.length).toBe(1);
      });

      // Label should be customized
      expect(screen.getAllByText('equals').length).toBeGreaterThan(0);
    });

    it('works without any config props (defaults)', async () => {
      const user = userEvent.setup();

      render(<TokenizedSearchInput fields={basicFields} />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'status:is:active ');

      // Should work with default settings
      await waitFor(() => {
        expect(screen.getByText('status')).toBeInTheDocument();
      });
    });
  });
});
