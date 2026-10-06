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
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { getFocusedToken } from '../../plugins/token-focus';
import type { SuggestionsConfig } from '../../types';
import { Unique } from '../../validation/presets';
import { basicFields } from '../fixtures/fields';
import { waitForEditor } from '../helpers/get-editor';
import { mountInput } from '../helpers/mount-input';
import { observeIntersections } from '../helpers/suggestion-layer';
import { filterTokens } from '../helpers/token-queries';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Waits for the animation frame in which the suggestions are evaluated after an edit. */
const nextFrame = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

describe('Config API', () => {
  describe('suggestions config', () => {
    /** Types `sta` into an empty input and waits for the text to be written. */
    async function typeFieldQuery(suggestions?: SuggestionsConfig) {
      const user = userEvent.setup();
      const { value } = await mountInput('', { suggestions });
      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByRole('combobox'), 'sta');
      await waitFor(() => expect(value()).toBe('sta'));
    }

    /** Clicks the status token, so its value is edited, and waits for that focus. */
    async function editStatusValue(suggestions?: SuggestionsConfig) {
      const user = userEvent.setup();
      const { editor } = await mountInput('status:is:active', { suggestions });
      await user.click(screen.getByRole('group', { name: /Filter: status/i }));
      await waitFor(() => expect(getFocusedToken(editor.state)).not.toBeNull());
    }

    it('shows field suggestions for typed text by default', async () => {
      await typeFieldQuery();

      expect(await screen.findByRole('option', { name: /Status/ })).toBeInTheDocument();
    });

    it('disables field suggestions when field.disabled is true', async () => {
      await typeFieldQuery({ field: { disabled: true } });
      await nextFrame();

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('shows value suggestions for the edited token by default', async () => {
      await editStatusValue();

      expect(await screen.findByRole('option', { name: /inactive/ })).toBeInTheDocument();
    });

    it('disables value suggestions when value.disabled is true', async () => {
      await editStatusValue({ value: { disabled: true } });
      await nextFrame();

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
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
      const scrollToEnd = observeIntersections();
      const user = userEvent.setup();
      await mountInput('', {
        suggestions: {
          custom: {
            debounceMs: 0,
            suggest: async () => ({
              suggestions: [
                { tokens: [{ key: 'status', operator: 'is', value: 'a' }], label: 'A' },
              ],
              hasMore: true,
            }),
            loadMore: () => new Promise<never>(() => {}),
          },
        },
        labels: {
          pagination: { loading: 'Loading more...', scrollForMore: 'Scroll to load' },
        },
      });

      await user.click(screen.getByRole('combobox'));
      expect(await screen.findByText('Scroll to load')).toBeInTheDocument();

      act(scrollToEnd);
      expect(await screen.findByText('Loading more...')).toBeInTheDocument();
      expect(screen.queryByText('Scroll to load')).not.toBeInTheDocument();
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

      const ref = createRef<TokenizedSearchInputRef>();
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={[dateField]}
          defaultValue="created:is:2024-01-01"
          pickers={{ renderDate: CustomDatePicker }}
        />
      );
      const editor = await waitForEditor(ref);
      const [token] = filterTokens(ref);
      if (!token) throw new Error('no filter token');

      act(() => {
        editor.commands.focusFilterToken(token.id, 'end');
      });

      expect(await screen.findByTestId('custom-date-picker')).toBeInTheDocument();
      expect(CustomDatePicker).toHaveBeenCalledWith(
        expect.objectContaining({ value: { date: '2024-01-01' } })
      );
    });

    it('uses the custom datetime picker renderer for a datetime field', async () => {
      const updatedField = {
        key: 'updated',
        label: 'Updated',
        type: 'datetime' as const,
        operators: ['gt'] as const,
      };
      const CustomDatePicker = vi.fn(() => <div data-testid="custom-date-picker" />);
      const CustomDateTimePicker = vi.fn(() => <div data-testid="custom-datetime-picker" />);

      const ref = createRef<TokenizedSearchInputRef>();
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={[updatedField]}
          defaultValue="updated:gt:2024-01-01T10:00Z"
          pickers={{ renderDate: CustomDatePicker, renderDateTime: CustomDateTimePicker }}
        />
      );
      const editor = await waitForEditor(ref);
      const [token] = filterTokens(ref);
      if (!token) throw new Error('no filter token');

      act(() => {
        editor.commands.focusFilterToken(token.id, 'end');
      });

      expect(await screen.findByTestId('custom-datetime-picker')).toBeInTheDocument();
      expect(CustomDateTimePicker).toHaveBeenCalledWith(
        expect.objectContaining({ value: { date: '2024-01-01', time: '10:00', offset: 'Z' } })
      );
      expect(screen.queryByTestId('custom-date-picker')).not.toBeInTheDocument();
      expect(CustomDatePicker).not.toHaveBeenCalled();
    });
  });

  describe('initialDelimiter', () => {
    it('reads and writes filters with the given delimiter', async () => {
      const { ref, value } = await mountInput('status=is=active', { initialDelimiter: '=' });

      await waitFor(() =>
        expect(filterTokens(ref)).toMatchObject([
          { key: 'status', operator: 'is', value: 'active' },
        ])
      );
      expect(value()).toBe('status=is=active');
    });

    it('reads the default delimiter as text when another one is given', async () => {
      const { ref, value } = await mountInput('status:is:active', { initialDelimiter: '=' });

      expect(filterTokens(ref)).toEqual([]);
      expect(value()).toBe('status:is:active');
    });

    it('turns typed text with the given delimiter into a filter', async () => {
      const user = userEvent.setup();
      const { ref, value } = await mountInput('', { initialDelimiter: '=' });

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'priority=high ');

      await waitFor(() =>
        expect(filterTokens(ref)).toMatchObject([
          { key: 'priority', operator: 'is', value: 'high' },
        ])
      );
      expect(value()).toBe('priority=is=high');
    });
  });

  describe('Multiple configs', () => {
    it('combines configuration from multiple config props', async () => {
      const { editor, value } = await mountInput('status:is:active status:is:pending', {
        suggestions: { field: { disabled: true } },
        validation: { rules: [Unique.rule('key')] },
        labels: { operators: { is: 'equals' } },
      });

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
      expect(screen.getAllByText('equals')).toHaveLength(2);

      // Typed text after the tokens opens no field suggestion
      act(() => {
        editor.chain().focus('end').insertContent(' pri').run();
      });
      await waitFor(() => expect(value()).toBe('status:is:active status:is:pending pri'));
      await nextFrame();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('works without any config props (defaults)', async () => {
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();

      render(<TokenizedSearchInput ref={ref} fields={basicFields} />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'status:active ');

      await waitFor(() => expect(filterTokens(ref)).toHaveLength(1));
      expect(ref.current?.getValue()).toBe('status:is:active');
    });
  });
});
