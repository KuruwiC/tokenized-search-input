import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { QuerySnapshot, QuerySnapshotFilterToken, ValidationRule } from '../../types';
import { Unique } from '../../validation/presets';
import { extendedFields } from '../fixtures';

function filterValues(snapshot: QuerySnapshot | undefined): string[] {
  return (snapshot?.segments ?? [])
    .filter((segment): segment is QuerySnapshotFilterToken => segment.type === 'filter')
    .map((segment) => `${segment.key}:${segment.value}`);
}

afterEach(() => cleanup());

describe('lifecycle callbacks', () => {
  describe('onChange', () => {
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

  describe('setValue', () => {
    it('replaces the content and requests validation in one transaction', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      render(<TokenizedSearchInput ref={ref} fields={extendedFields} />);
      await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
      const editor = ref.current?.getEditor();
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
