import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { getFocusedToken } from '../../plugins/token-focus/state';
import type { QuerySnapshot, QuerySnapshotFilterToken, ValidationRule } from '../../types';
import { getFilterTokens, getPlainText } from '../../utils/query-snapshot';
import { Unique } from '../../validation/presets';
import { basicFields, extendedFields } from '../fixtures';
import { waitForEditor } from '../helpers/get-editor';

function filterValues(snapshot: QuerySnapshot | undefined): string[] {
  return (snapshot?.segments ?? [])
    .filter((segment): segment is QuerySnapshotFilterToken => segment.type === 'filter')
    .map((segment) => `${segment.key}:${segment.value}`);
}

afterEach(() => cleanup());

describe('lifecycle callbacks', () => {
  describe('onChange', () => {
    it('preserves whitespace in getPlainText output', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<TokenizedSearchInput fields={basicFields} onChange={onChange} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);
      await user.type(editor, 'hello world');

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        const snapshot = lastCall[0];
        const plainText = getPlainText(snapshot);
        expect(plainText).toContain('hello');
        expect(plainText).toContain('world');
      });
    });

    it('is not called when the input is disabled and enabled again', async () => {
      const onChange = vi.fn<(snapshot: QuerySnapshot) => void>();
      const view = render(
        <TokenizedSearchInput
          fields={extendedFields}
          defaultValue="status:is:active"
          onChange={onChange}
        />
      );
      await screen.findByText('active');
      onChange.mockClear();

      view.rerender(
        <TokenizedSearchInput
          fields={extendedFields}
          defaultValue="status:is:active"
          onChange={onChange}
          disabled
        />
      );
      await waitFor(() =>
        expect(screen.getByRole('combobox')).toHaveAttribute('contenteditable', 'false')
      );
      view.rerender(
        <TokenizedSearchInput
          fields={extendedFields}
          defaultValue="status:is:active"
          onChange={onChange}
        />
      );
      await waitFor(() =>
        expect(screen.getByRole('combobox')).toHaveAttribute('contenteditable', 'true')
      );

      expect(onChange).not.toHaveBeenCalled();
    });

    it('is called once when focus leaving an empty token removes it', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn<(snapshot: QuerySnapshot) => void>();
      render(
        <div>
          <TokenizedSearchInput fields={extendedFields} onChange={onChange} />
          <button type="button">Other Element</button>
        </div>
      );

      await user.click(screen.getByRole('combobox'));
      await user.keyboard('status:');
      await screen.findByPlaceholderText('...');
      onChange.mockClear();

      act(() => {
        screen.getByRole('button', { name: 'Other Element' }).focus();
      });

      await waitFor(() => expect(screen.queryByPlaceholderText('...')).not.toBeInTheDocument());
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0]?.[0].segments).toEqual([]);
    });
  });

  describe('initial content', () => {
    /**
     * onTokensChange fires for the initial tokens of defaultValue: the first update is
     * compared against an empty snapshot.
     */
    it('fires onTokensChange for initial tokens from defaultValue', async () => {
      let capturedTokens: QuerySnapshotFilterToken[] = [];
      const onTokensChange = vi.fn((snapshot: QuerySnapshot) => {
        capturedTokens = getFilterTokens(snapshot);
      });

      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="status:is:active priority:is:high"
          onTokensChange={onTokensChange}
        />
      );

      await waitFor(() => {
        expect(capturedTokens.length).toBe(2);
      });

      expect(capturedTokens[0].key).toBe('status');
      expect(capturedTokens[0].value).toBe('active');
      expect(capturedTokens[1].key).toBe('priority');
      expect(capturedTokens[1].value).toBe('high');
    });

    it('reports the content left once the initial content is entered, once', async () => {
      const onChange = vi.fn<(snapshot: QuerySnapshot) => void>();
      render(
        <TokenizedSearchInput
          fields={extendedFields}
          defaultValue="status:is:active status:is:closed"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'reject' })] }}
          onChange={onChange}
        />
      );
      await screen.findByText('active');

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(filterValues(onChange.mock.calls[0]?.[0])).toEqual(['status:active']);
    });

    it('reports nothing when entering the initial content leaves it empty', async () => {
      const onChange = vi.fn<(snapshot: QuerySnapshot) => void>();
      const rejectAll: ValidationRule = {
        id: 'reject-all',
        validate: (ctx) =>
          ctx.tokens.map((token) => ({
            ruleId: 'reject-all',
            reason: 'rejected',
            action: 'delete' as const,
            targets: [{ tokenId: token.id }],
          })),
      };
      render(
        <TokenizedSearchInput
          fields={extendedFields}
          defaultValue="status:is:active"
          validation={{ rules: [rejectAll] }}
          onChange={onChange}
        />
      );
      await waitFor(() => expect(screen.queryByText('active')).not.toBeInTheDocument());

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('onTokensChange', () => {
    /**
     * The focused token is excluded from the comparison of confirmed tokens, so a change
     * made in it is reported once focus leaves it. This test covers deleting a token.
     */
    it('fires onTokensChange when token is deleted', async () => {
      const onTokensChange = vi.fn();
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={basicFields}
          defaultValue="status:is:active priority:is:high"
          onTokensChange={onTokensChange}
        />
      );

      await waitFor(() => {
        expect(onTokensChange).toHaveBeenCalled();
      });

      const initialCallCount = onTokensChange.mock.calls.length;

      const deleteButtons = screen.getAllByRole('button', { name: /delete|remove/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(onTokensChange.mock.calls.length).toBeGreaterThan(initialCallCount);
      });

      const lastCall = onTokensChange.mock.calls[onTokensChange.mock.calls.length - 1];
      const tokens = getFilterTokens(lastCall[0]);
      expect(tokens.length).toBe(1);
    });

    it('reports a focused token once it is confirmed, after a report made while it was edited', async () => {
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();
      const onTokensChange = vi.fn<(snapshot: QuerySnapshot) => void>();
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={extendedFields}
          defaultValue="assignee:is:john priority:is:high"
          onTokensChange={onTokensChange}
        />
      );
      await screen.findByText('john');
      const [, priority] = ref.current?.getSnapshot().segments ?? [];

      await user.click(screen.getByRole('group', { name: /Filter: assignee/i }));
      await user.type(await screen.findByPlaceholderText('...'), 'X');
      act(() => {
        if (priority?.type === 'filter') ref.current?.updateToken(priority.id, { value: 'low' });
      });
      onTokensChange.mockClear();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        const editor = ref.current?.getEditor();
        expect(editor && getFocusedToken(editor.state)).toBeNull();
      });
      expect(onTokensChange).toHaveBeenCalledTimes(1);
      expect(filterValues(onTokensChange.mock.calls[0]?.[0])).toEqual([
        'assignee:johnX',
        'priority:low',
      ]);
    });
  });

  describe('setValue', () => {
    it('replaces the content and requests validation in one transaction', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      render(<TokenizedSearchInput ref={ref} fields={extendedFields} />);
      const editor = await waitForEditor(ref);
      const count = vi.fn();
      editor?.on('transaction', count);

      act(() => {
        ref.current?.setValue('status:is:active');
      });

      expect(ref.current?.getValue()).toBe('status:is:active');
      expect(count).toHaveBeenCalledTimes(1);
    });
  });
});
