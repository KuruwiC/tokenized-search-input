import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { QuerySnapshot } from '../../types';
import { extendedFields } from '../fixtures';

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
});
