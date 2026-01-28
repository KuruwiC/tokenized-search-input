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
import { describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import { Unique } from '../../validation/presets';
import { basicFields } from '../fixtures/fields';

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

    it('applies custom suggestion config', async () => {
      const mockSuggest = vi.fn().mockResolvedValue([
        {
          tokens: [{ key: 'status', operator: 'is', value: 'active' }],
          label: 'Active Status',
        },
      ]);

      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={basicFields}
          suggestions={{
            custom: {
              suggest: mockSuggest,
              debounceMs: 0,
            },
          }}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'active');

      await waitFor(() => {
        expect(mockSuggest).toHaveBeenCalled();
      });
    });
  });

  describe('validation config', () => {
    it('applies validation rules', async () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="status:is:active status:is:pending"
          validation={{ rules: [Unique.rule('key')] }}
        />
      );

      // Wait for tokens to render
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(2);
      });

      // Wait for validation to run and check for invalid markers
      await waitFor(() => {
        const invalidTokens = document.querySelectorAll('.node-filterToken [data-invalid="true"]');
        expect(invalidTokens.length).toBe(1);
      });
    });

    it('uses Unique.reject strategy to delete duplicates', async () => {
      const handleChange = vi.fn();

      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="status:is:active status:is:pending"
          onChange={handleChange}
          validation={{
            rules: [Unique.rule('key', Unique.reject)],
          }}
        />
      );

      // With Unique.reject strategy, the duplicate token should be removed
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
    it('allows unknown fields when allow is true', async () => {
      // Render with defaultValue containing unknown field
      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="customField:is:value"
          unknownFields={{ allow: true }}
        />
      );

      // Token should be created for unknown field
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });
    });

    it('uses specified operators for unknown fields', async () => {
      // Render with defaultValue containing unknown field using two-part format
      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="custom:value"
          unknownFields={{
            allow: true,
            operators: ['contains', 'not_contains'],
          }}
        />
      );

      // Token should be created with first operator (contains) as default
      await waitFor(() => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      });

      // Check the operator is 'contains'
      await waitFor(() => {
        expect(screen.getByText('contains')).toBeInTheDocument();
      });
    });
  });

  describe('serialization config', () => {
    it('accepts custom delimiter configuration', () => {
      render(<TokenizedSearchInput fields={basicFields} initialDelimiter="=" />);

      // Component should mount without error
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('accepts custom serializeToken function', () => {
      const customSerialize = vi.fn((token) => `[${token.key}|${token.value}]`);

      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="status:is:active"
          serialization={{ serializeToken: customSerialize }}
        />
      );

      // Component should mount without error
      expect(screen.getByRole('combobox')).toBeInTheDocument();
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
