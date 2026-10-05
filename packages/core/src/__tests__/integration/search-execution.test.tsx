/**
 * Integration tests for search execution behavior.
 * Tests the onSubmit callback and query serialization when search is triggered.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { getFocusedToken } from '../../plugins/token-focus';
import type { QuerySnapshot } from '../../types';
import { extendedFields } from '../fixtures';

afterEach(() => {
  cleanup();
});

describe('Search Execution', () => {
  it('triggers onSubmit when Enter is pressed', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <TokenizedSearchInput
        fields={extendedFields}
        defaultValue="status:is:active"
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    const editor = screen.getByRole('combobox');
    await user.click(editor);

    // Close the field suggestion dropdown first
    await user.keyboard('{Escape}');

    // Ensure suggestion is closed
    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: /filter fields/i })).not.toBeInTheDocument();
    });

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const [snapshot] = onSubmit.mock.calls[0];
      expect(snapshot.text).toBe('status:is:active');
      expect(snapshot.segments).toHaveLength(1);
      expect(snapshot.segments[0]).toMatchObject({
        type: 'filter',
        key: 'status',
        operator: 'is',
        value: 'active',
      });
    });
  });

  it('passes the same snapshot for Enter and ref.submit() in tokenize mode', async () => {
    const user = userEvent.setup();
    const withoutIds = (snapshot: QuerySnapshot | undefined) => ({
      text: snapshot?.text,
      segments: snapshot?.segments.map((segment) => ({ ...segment, id: undefined })),
    });

    const onEnterSubmit = vi.fn<(snapshot: QuerySnapshot) => void>();
    const first = render(
      <TokenizedSearchInput
        fields={extendedFields}
        freeTextMode="tokenize"
        onSubmit={onEnterSubmit}
      />
    );
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('hello{Enter}');
    await waitFor(() => expect(onEnterSubmit).toHaveBeenCalledTimes(1));
    first.unmount();

    const ref = createRef<TokenizedSearchInputRef>();
    const onRefSubmit = vi.fn<(snapshot: QuerySnapshot) => void>();
    render(
      <TokenizedSearchInput
        ref={ref}
        fields={extendedFields}
        freeTextMode="tokenize"
        onSubmit={onRefSubmit}
      />
    );
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('hello');
    act(() => {
      ref.current?.submit();
    });

    expect(onRefSubmit).toHaveBeenCalledTimes(1);
    expect(withoutIds(onRefSubmit.mock.calls[0]?.[0])).toEqual(
      withoutIds(onEnterSubmit.mock.calls[0]?.[0])
    );
    expect(onRefSubmit.mock.calls[0]?.[0].segments[0]).toMatchObject({
      type: 'freeText',
      value: 'hello',
    });
  });

  it('leaves and confirms the token being edited before ref.submit() reports', async () => {
    const user = userEvent.setup();
    const ref = createRef<TokenizedSearchInputRef>();
    const onSubmit = vi.fn<(snapshot: QuerySnapshot) => void>();
    render(
      <TokenizedSearchInput
        ref={ref}
        fields={extendedFields}
        defaultValue="assignee:is:john"
        onSubmit={onSubmit}
      />
    );
    await screen.findByText('john');
    await user.click(screen.getByRole('group', { name: /Filter: assignee/i }));
    await user.type(await screen.findByPlaceholderText('...'), 'X');

    // Leaving the token moves focus out of the typed input while React commits, and
    // user-event reports that blur as a change event inside act() of its own. A sync act
    // has already closed its scope when it flushes the commit, so React 19 sees that
    // nested act at the top level and leaves its work unflushed; an awaited act commits
    // while its scope is still open.
    await act(async () => {
      ref.current?.submit();
    });

    const editor = ref.current?.getEditor();
    expect(editor && getFocusedToken(editor.state)).toBeNull();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].text).toBe('assignee:is:johnX');
  });
});
