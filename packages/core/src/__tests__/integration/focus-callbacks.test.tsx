/**
 * Integration tests for focus-related callbacks.
 * Tests onBlur, onFocus, and onClear callback behaviors.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
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
    it('does not trigger onFocus again when focus moves into a token', async () => {
      const onFocus = vi.fn();
      const user = userEvent.setup();
      render(
        <TokenizedSearchInput
          fields={extendedFields}
          defaultValue="status:is:active"
          onFocus={onFocus}
        />
      );

      await user.click(screen.getByRole('combobox'));
      await waitFor(() => {
        expect(onFocus).toHaveBeenCalledTimes(1);
      });
      await user.click(screen.getByRole('group', { name: /status/i }));
      await waitFor(() => {
        expect(screen.getByRole('group', { name: /status/i })).toContainElement(
          document.activeElement as HTMLElement
        );
      });

      expect(onFocus).toHaveBeenCalledTimes(1);
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

    it('triggers onBlur once when focus leaves while a value suggestion is open', async () => {
      const onBlur = vi.fn();
      const user = userEvent.setup();
      render(
        <div>
          <TokenizedSearchInput fields={extendedFields} onBlur={onBlur} />
          <button type="button">Other Element</button>
        </div>
      );

      await user.click(screen.getByRole('combobox'));
      await user.keyboard('status');
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Status'));
      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
      });

      act(() => {
        screen.getByRole('button', { name: 'Other Element' }).focus();
      });

      await waitFor(() => {
        expect(onBlur).toHaveBeenCalledTimes(1);
      });
    });

    it('triggers onBlur once when Tab leaves the container while a value suggestion is open', async () => {
      const onBlur = vi.fn();
      const user = userEvent.setup();
      render(
        <div>
          <TokenizedSearchInput fields={extendedFields} onBlur={onBlur} />
          <button type="button">Other Element</button>
        </div>
      );

      await user.click(screen.getByRole('combobox'));
      await user.keyboard('status');
      await user.click(await screen.findByText('Status'));
      await screen.findByText('active');

      // The first Tab leaves the token for the editor, the second leaves the container.
      await user.tab();
      await user.tab();

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Other Element' })).toHaveFocus()
      );
      await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1));
    });

    it('triggers onBlur when focus leaves after a press on a suggestion that selected nothing', async () => {
      const onBlur = vi.fn();
      const user = userEvent.setup();
      render(
        <div>
          <TokenizedSearchInput fields={extendedFields} onBlur={onBlur} />
          <button type="button">Other Element</button>
        </div>
      );

      await user.click(screen.getByRole('combobox'));
      await user.keyboard('stat');
      const option = await screen.findByText('Status');
      // The press starts on the option and is released outside it, so nothing is selected.
      await user.pointer([
        { keys: '[MouseLeft>]', target: option },
        { keys: '[/MouseLeft]', target: document.body },
      ]);
      expect(screen.getByRole('combobox')).toHaveFocus();

      act(() => {
        screen.getByRole('button', { name: 'Other Element' }).focus();
      });

      await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1));
    });

    it('keeps focus in the input when a press in the suggestion list lands outside an option', async () => {
      const onBlur = vi.fn();
      const user = userEvent.setup();
      const { container } = render(
        <TokenizedSearchInput fields={extendedFields} onBlur={onBlur} />
      );

      await user.click(screen.getByRole('combobox'));
      await user.keyboard('stat');
      await screen.findByText('Status');
      const suggestionRoot = container.querySelector('[data-suggestion-root]');
      if (!suggestionRoot) throw new Error('suggestion list not rendered');

      await user.click(suggestionRoot);

      expect(screen.getByRole('combobox')).toHaveFocus();
      expect(onBlur).not.toHaveBeenCalled();
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

    it('triggers onClear when the ref clears the content', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const onClear = vi.fn();
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={extendedFields}
          defaultValue="status:is:active"
          onClear={onClear}
        />
      );
      await screen.findByText('active');

      act(() => {
        ref.current?.clear();
      });

      expect(ref.current?.getValue()).toBe('');
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });
});
