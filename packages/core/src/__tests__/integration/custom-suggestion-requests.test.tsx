/**
 * Integration tests for the requests of custom suggestions: the pagination that lives in the
 * suggestion state, the timers of a request, and what selecting a suggestion writes.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { closeHistory } from '@tiptap/pm/history';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { getSuggestionState } from '../../plugins/suggestion-plugin';
import type {
  CustomSuggestion,
  CustomSuggestionConfig,
  SuggestionErrorContext,
  SuggestionsConfig,
} from '../../types';
import { customOptions, fields, renderInput } from '../helpers/suggestion-layer';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
});

describe('pagination of custom suggestions', () => {
  function observeIntersections() {
    const observed = new Set<IntersectionObserverCallback>();
    class ControlledObserver {
      private readonly callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe() {
        observed.add(this.callback);
      }
      unobserve() {}
      disconnect() {
        observed.delete(this.callback);
      }
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', ControlledObserver);
    return () => {
      for (const callback of [...observed]) {
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }
    };
  }

  const page = (names: string[]): CustomSuggestion[] =>
    names.map((label) => ({ label, tokens: [{ key: 'owner', operator: 'is', value: label }] }));

  it('starts at offset 0 when the suggestions open again after an Escape', async () => {
    const scrollToEnd = observeIntersections();
    const user = userEvent.setup();
    const loadMore = vi.fn(async ({ offset }: { offset: number }) => ({
      suggestions: page([`more-${offset}`]),
      hasMore: true,
    }));
    const { editor } = await renderInput({
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          suggest: async () => ({ suggestions: page(['one', 'two']), hasMore: true }),
          loadMore,
        },
      },
    });

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: /one/ });
    act(scrollToEnd);
    await screen.findByRole('option', { name: /more-2/ });
    expect(loadMore).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 2 }));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(getSuggestionState(editor.state)?.custom).toEqual({
      hasMore: false,
      offset: 0,
      isLoadingMore: false,
    });

    act(() => {
      editor.commands.insertContent('x');
    });
    await screen.findByRole('option', { name: /one/ });
    expect(screen.queryByRole('option', { name: /more-2/ })).not.toBeInTheDocument();
    act(scrollToEnd);
    await waitFor(() => expect(loadMore).toHaveBeenCalledTimes(2));
    expect(loadMore).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 2 }));
  });

  it('drops a page that was requested before the suggestions closed', async () => {
    const scrollToEnd = observeIntersections();
    const user = userEvent.setup();
    const resolvers: Array<
      (result: { suggestions: CustomSuggestion[]; hasMore: boolean }) => void
    > = [];
    const loadMore = vi.fn(
      () =>
        new Promise<{ suggestions: CustomSuggestion[]; hasMore: boolean }>((resolve) => {
          resolvers.push(resolve);
        })
    );
    const { editor } = await renderInput({
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          suggest: async () => ({ suggestions: page(['one', 'two']), hasMore: true }),
          loadMore,
        },
      },
    });

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: /one/ });
    act(scrollToEnd);
    await waitFor(() => expect(loadMore).toHaveBeenCalledTimes(1));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    act(() => {
      editor.commands.insertContent('x');
    });
    await screen.findByRole('option', { name: /one/ });

    // The page of the earlier session neither blocks nor joins the new one
    act(scrollToEnd);
    await waitFor(() => expect(loadMore).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolvers[0]?.({ suggestions: page(['stale']), hasMore: false });
    });
    expect(screen.queryByRole('option', { name: /stale/ })).not.toBeInTheDocument();
    await act(async () => {
      resolvers[1]?.({ suggestions: page(['fresh']), hasMore: false });
    });
    expect(await screen.findByRole('option', { name: /fresh/ })).toBeInTheDocument();
  });
});

describe('request timers of custom suggestions', () => {
  async function renderWithFakeTimers(suggestions?: SuggestionsConfig) {
    const ref = createRef<TokenizedSearchInputRef>();
    await act(async () => {
      render(<TokenizedSearchInput ref={ref} fields={fields} suggestions={suggestions} />);
      await vi.advanceTimersByTimeAsync(0);
    });
    const editor = ref.current?.getEditor();
    if (!editor) throw new Error('editor not created');
    act(() => {
      editor.commands.focus();
    });
    // Past the debounce of the request
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
  }

  it('leaves no timer once a suggest has resolved', async () => {
    vi.useFakeTimers();
    const suggest = vi.fn(async () => customOptions);

    await renderWithFakeTimers({ custom: { displayMode: 'replace', suggest } });

    expect(suggest).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer after the input is gone while a suggest has not resolved', async () => {
    vi.useFakeTimers();
    await renderWithFakeTimers();
    cleanup();
    // What unmounting the editor itself leaves
    const baseline = vi.getTimerCount();

    const suggest = vi.fn(() => new Promise<CustomSuggestion[]>(() => {}));
    await renderWithFakeTimers({ custom: { displayMode: 'replace', suggest } });
    expect(suggest).toHaveBeenCalled();
    cleanup();

    expect(vi.getTimerCount()).toBe(baseline);
  });

  it('reports a suggest that does not resolve within timeoutMs', async () => {
    const onError = vi.fn<(error: Error, context: SuggestionErrorContext) => void>();
    const config: CustomSuggestionConfig = {
      displayMode: 'replace',
      debounceMs: 0,
      timeoutMs: 20,
      suggest: () => new Promise<CustomSuggestion[]>(() => {}),
      onError,
    };
    const { editor } = await renderInput({ suggestions: { custom: config } });

    act(() => {
      editor.commands.focus();
    });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]?.[0].message).toMatch(/timed out after 20ms/);
    expect(onError.mock.calls[0]?.[1]).toEqual({ type: 'suggest', query: '' });
  });
});

describe('selecting a custom suggestion', () => {
  it('undoes the typed text removal and the inserted tokens as one step', async () => {
    const user = userEvent.setup();
    const { ref, editor } = await renderInput({
      suggestions: {
        custom: { displayMode: 'replace', debounceMs: 0, suggest: () => customOptions },
      },
    });
    await user.click(screen.getByRole('combobox'));
    act(() => {
      editor.commands.insertContent('fir');
      editor.view.dispatch(closeHistory(editor.state.tr));
    });
    await user.click(await screen.findByRole('option', { name: /First/ }));
    await waitFor(() => expect(ref.current?.getValue()).toBe('owner:is:first'));

    act(() => {
      editor.commands.undo();
    });

    expect(ref.current?.getValue()).toBe('fir');
  });

  it('removes the typed text and inserts the tokens in one transaction', async () => {
    const user = userEvent.setup();
    const { editor } = await renderInput({
      suggestions: {
        custom: { displayMode: 'replace', debounceMs: 0, suggest: () => customOptions },
      },
    });
    await user.click(screen.getByRole('combobox'));
    act(() => {
      editor.commands.insertContent('fir');
    });
    const option = await screen.findByRole('option', { name: /First/ });
    const docChanges: number[] = [];
    editor.on('transaction', ({ transaction }) => {
      if (transaction.docChanged) docChanges.push(transaction.steps.length);
    });

    await user.click(option);

    await waitFor(() => expect(docChanges.length).toBeGreaterThan(0));
    expect(docChanges).toHaveLength(1);
  });

  it.each([
    [true, ''],
    [false, 'owner:is:first'],
  ])('lets onSelect that returns %s decide whether the tokens are inserted', async (handled, value) => {
    const user = userEvent.setup();
    const onSelect = vi.fn(() => handled);
    const { ref, editor } = await renderInput({
      defaultValue: 'status:is:a',
      suggestions: {
        custom: { displayMode: 'replace', debounceMs: 0, suggest: () => customOptions, onSelect },
      },
    });
    act(() => {
      editor.commands.focus('end');
      editor.commands.insertContent(' fir');
    });
    await user.click(await screen.findByRole('option', { name: /First/ }));

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onSelect.mock.calls[0]).toEqual([
      customOptions[0],
      expect.objectContaining({ existingTokens: [expect.objectContaining({ key: 'status' })] }),
    ]);
    await waitFor(() =>
      expect(ref.current?.getValue()).toBe(value ? `status:is:a ${value}` : 'status:is:a')
    );
  });
});
