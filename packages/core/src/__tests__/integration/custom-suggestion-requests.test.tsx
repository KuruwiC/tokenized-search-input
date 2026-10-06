/**
 * Integration tests for the requests of custom suggestions: the pagination that lives in the
 * suggestion state, the timers of a request, and what selecting a suggestion writes.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { closeHistory } from '@tiptap/pm/history';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { getSuggestionState } from '../../plugins/suggestion';
import type {
  CustomSuggestion,
  CustomSuggestionConfig,
  CustomSuggestionResult,
  FieldDefinition,
  SuggestContext,
  SuggestContextWithPagination,
  SuggestionErrorContext,
  SuggestionsConfig,
} from '../../types';
import {
  customOptions,
  fields,
  observeIntersections,
  page,
  renderInput,
} from '../helpers/suggestion-layer';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
});

describe('pagination of custom suggestions', () => {
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

describe('pages of custom suggestions', () => {
  const optionTexts = () => screen.getAllByRole('option').map((option) => option.textContent ?? '');

  it.each([
    'prepend',
    'append',
  ] as const)('adds a loaded page after the custom suggestions it follows (%s)', async (displayMode) => {
    const scrollToEnd = observeIntersections();
    const user = userEvent.setup();
    const loadMore = vi.fn(async () => ({ suggestions: page(['three']), hasMore: false }));
    await renderInput({
      suggestions: {
        custom: {
          displayMode,
          debounceMs: 0,
          suggest: async () => ({ suggestions: page(['one', 'two']), hasMore: true }),
          loadMore,
        },
      },
    });

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: /two/ });
    act(scrollToEnd);
    await screen.findByRole('option', { name: /three/ });

    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(loadMore).toHaveBeenCalledWith(expect.objectContaining({ offset: 2 }));
    const texts = optionTexts();
    expect(texts).toHaveLength(fields.length + 3);
    const custom = displayMode === 'prepend' ? texts.slice(0, 3) : texts.slice(fields.length);
    expect(custom).toEqual(['one', 'two', 'three']);
    expect(screen.queryByText('Scroll for more')).not.toBeInTheDocument();
  });

  it.each([
    [3, 3],
    [undefined, 5],
  ])('lists at most maxSuggestions (%s) and asks loadMore for that many', async (maxSuggestions, limit) => {
    const scrollToEnd = observeIntersections();
    const user = userEvent.setup();
    const loadMore = vi.fn(() => new Promise<never>(() => {}));
    await renderInput({
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          maxSuggestions,
          suggest: async () => ({
            suggestions: page(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
            hasMore: true,
          }),
          loadMore,
        },
      },
    });

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: /a/ });
    expect(optionTexts()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'].slice(0, limit));

    act(scrollToEnd);
    await waitFor(() => expect(loadMore).toHaveBeenCalledTimes(1));
    expect(loadMore).toHaveBeenCalledWith(expect.objectContaining({ offset: limit, limit }));
  });

  it('lets a page that failed to load be loaded again', async () => {
    const scrollToEnd = observeIntersections();
    const user = userEvent.setup();
    const onError = vi.fn<(error: Error, context: SuggestionErrorContext) => void>();
    const loadMore = vi
      .fn<(context: SuggestContextWithPagination) => Promise<CustomSuggestionResult>>()
      .mockRejectedValueOnce(new Error('loadMore failed'))
      .mockResolvedValueOnce({ suggestions: page(['three']), hasMore: false });
    await renderInput({
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          suggest: async () => ({ suggestions: page(['one', 'two']), hasMore: true }),
          loadMore,
          onError,
        },
      },
    });

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: /two/ });
    act(scrollToEnd);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'loadMore failed' }),
      expect.objectContaining({ type: 'loadMore' })
    );

    expect(await screen.findByText('Scroll for more')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();

    act(scrollToEnd);
    await screen.findByRole('option', { name: /three/ });
    expect(loadMore).toHaveBeenCalledTimes(2);
    expect(loadMore).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 2 }));
    expect(optionTexts()).toEqual(['one', 'two', 'three']);
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

describe('closing the suggestions while a request is pending', () => {
  function pendingSuggest() {
    let resolve: (suggestions: CustomSuggestion[]) => void = () => {};
    const suggest = vi.fn(
      () =>
        new Promise<CustomSuggestion[]>((done) => {
          resolve = done;
        })
    );
    return { suggest, resolve: (value: CustomSuggestion[]) => resolve(value) };
  }

  it('does not open the suggestions again when the response comes after an Escape', async () => {
    const user = userEvent.setup();
    const { suggest, resolve } = pendingSuggest();
    const { editor } = await renderInput({
      suggestions: { custom: { displayMode: 'replace', debounceMs: 0, suggest } },
    });
    await user.click(screen.getByRole('combobox', { name: 'Search query input' }));
    await screen.findByRole('listbox');
    await waitFor(() => expect(suggest).toHaveBeenCalled());

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await act(async () => {
      resolve(customOptions);
    });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(getSuggestionState(editor.state)?.type).toBeNull();
  });

  it('does not open the suggestions when the response comes after the focus left', async () => {
    const user = userEvent.setup();
    const { suggest, resolve } = pendingSuggest();
    const { editor } = await renderInput({
      suggestions: { custom: { displayMode: 'replace', debounceMs: 0, suggest } },
    });
    await user.click(screen.getByRole('combobox', { name: 'Search query input' }));
    await waitFor(() => expect(suggest).toHaveBeenCalled());

    await user.click(document.body);
    await waitFor(() => expect(getSuggestionState(editor.state)?.dismissed).toBe(true));
    await act(async () => {
      resolve(customOptions);
    });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(getSuggestionState(editor.state)?.type).toBeNull();
  });

  it('does not add a page that arrives after an Escape', async () => {
    const scrollToEnd = observeIntersections();
    const user = userEvent.setup();
    let resolve: (value: { suggestions: CustomSuggestion[]; hasMore: boolean }) => void = () => {};
    const { editor } = await renderInput({
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          suggest: async () => ({ suggestions: page(['one']), hasMore: true }),
          loadMore: () =>
            new Promise((done) => {
              resolve = done;
            }),
        },
      },
    });
    await user.click(screen.getByRole('combobox', { name: 'Search query input' }));
    await screen.findByRole('option', { name: /one/ });
    act(scrollToEnd);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());

    await act(async () => {
      resolve({ suggestions: page(['late']), hasMore: false });
    });

    expect(getSuggestionState(editor.state)?.type).toBeNull();
    expect(screen.queryByRole('option', { name: /late/ })).not.toBeInTheDocument();
  });

  it('leaves no timer behind once the suggestions are closed', async () => {
    async function timersAfterEscape(suggestions?: SuggestionsConfig) {
      vi.useFakeTimers();
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
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      fireEvent.keyDown(editor.view.dom, { key: 'Escape' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const count = vi.getTimerCount();
      cleanup();
      vi.useRealTimers();
      return count;
    }

    const baseline = await timersAfterEscape();
    const suggest = vi.fn(() => new Promise<CustomSuggestion[]>(() => {}));
    const withRequest = await timersAfterEscape({ custom: { displayMode: 'replace', suggest } });

    expect(suggest).toHaveBeenCalled();
    expect(withRequest).toBe(baseline);
  });
});

describe('the signal passed to suggest and loadMore', () => {
  /** A suggest whose calls stay pending until resolved, with the signal each one got. */
  function pendingSuggest() {
    const calls: Array<{ signal: AbortSignal; resolve: (result: CustomSuggestion[]) => void }> = [];
    const suggest = vi.fn(
      ({ signal }: SuggestContext) =>
        new Promise<CustomSuggestion[]>((resolve) => {
          calls.push({ signal, resolve });
        })
    );
    return { suggest, calls };
  }

  async function startSuggest() {
    const user = userEvent.setup();
    const { suggest, calls } = pendingSuggest();
    const { editor } = await renderInput({
      suggestions: { custom: { displayMode: 'replace', debounceMs: 0, suggest } },
    });
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => expect(calls).toHaveLength(1));
    const first = calls[0];
    if (!first) throw new Error('suggest was not called');
    expect(first.signal.aborted).toBe(false);
    return { user, editor, calls, first };
  }

  it('aborts the signal of a pending suggest when the suggestions close', async () => {
    const { user, first } = await startSuggest();

    await user.keyboard('{Escape}');

    expect(first.signal.aborted).toBe(true);
  });

  it('aborts the signal of a pending suggest when a newer query starts', async () => {
    const { editor, calls, first } = await startSuggest();

    act(() => {
      editor.commands.insertContent('x');
    });
    await waitFor(() => expect(calls).toHaveLength(2));

    expect(first.signal.aborted).toBe(true);
    expect(calls[1]?.signal.aborted).toBe(false);
  });

  it('aborts the signal of a pending suggest when the input unmounts', async () => {
    const { first } = await startSuggest();

    cleanup();

    expect(first.signal.aborted).toBe(true);
  });

  it('leaves the signal of a suggest that resolved alone', async () => {
    const { user, first } = await startSuggest();

    await act(async () => {
      first.resolve(customOptions);
    });
    await screen.findByRole('option', { name: /First/ });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    cleanup();

    expect(first.signal.aborted).toBe(false);
  });

  it('leaves the signal of a suggest that threw alone', async () => {
    const user = userEvent.setup();
    const onError = vi.fn<(error: Error, context: SuggestionErrorContext) => void>();
    const signals: AbortSignal[] = [];
    await renderInput({
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          suggest: ({ signal }) => {
            signals.push(signal);
            throw new Error('suggest failed');
          },
          onError,
        },
      },
    });

    await user.click(screen.getByRole('combobox'));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    await user.keyboard('{Escape}');
    cleanup();

    expect(signals[0]?.aborted).toBe(false);
  });

  it('leaves the signal of a loadMore that threw alone', async () => {
    const scrollToEnd = observeIntersections();
    const user = userEvent.setup();
    const onError = vi.fn<(error: Error, context: SuggestionErrorContext) => void>();
    const signals: AbortSignal[] = [];
    await renderInput({
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          suggest: async () => ({ suggestions: page(['one', 'two']), hasMore: true }),
          loadMore: ({ signal }) => {
            signals.push(signal);
            throw new Error('loadMore failed');
          },
          onError,
        },
      },
    });
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: /one/ });
    act(scrollToEnd);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    await user.keyboard('{Escape}');
    cleanup();

    expect(signals[0]?.aborted).toBe(false);
  });

  it('handles the rejection of a suggest whose request was abandoned while it was called', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      let rejectLate: ((error: Error) => void) | undefined;
      let calls = 0;
      const { editor } = await renderInput({
        suggestions: {
          custom: {
            displayMode: 'replace',
            debounceMs: 0,
            suggest: () => {
              calls += 1;
              if (calls > 1) return [];
              // A newer query starts before this call returns
              editor.commands.insertContent('x');
              return new Promise<CustomSuggestion[]>((_, reject) => {
                rejectLate = reject;
              });
            },
          },
        },
      });

      act(() => {
        editor.commands.focus();
      });
      await waitFor(() => expect(rejectLate).toBeDefined());
      await act(async () => {
        rejectLate?.(new Error('late failure'));
      });
      // Node reports a rejection that nothing handled once the microtasks have run, before
      // the next macrotask
      await new Promise((resolve) => setImmediate(resolve));

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('aborts the signal of a suggest that runs past timeoutMs and reports the timeout once', async () => {
    const onError = vi.fn<(error: Error, context: SuggestionErrorContext) => void>();
    const signals: AbortSignal[] = [];
    const { editor } = await renderInput({
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          timeoutMs: 20,
          suggest: ({ signal }) => {
            signals.push(signal);
            return new Promise<CustomSuggestion[]>(() => {});
          },
          onError,
        },
      },
    });

    act(() => {
      editor.commands.focus();
    });

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[0]?.reason).toMatchObject({ name: 'TimeoutError' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0].message).toMatch(/timed out after 20ms/);
  });

  async function startLoadMore() {
    const scrollToEnd = observeIntersections();
    const user = userEvent.setup();
    const calls: Array<{
      signal: AbortSignal;
      resolve: (result: { suggestions: CustomSuggestion[]; hasMore: boolean }) => void;
    }> = [];
    const loadMore = vi.fn(
      ({ signal }: SuggestContextWithPagination) =>
        new Promise<{ suggestions: CustomSuggestion[]; hasMore: boolean }>((resolve) => {
          calls.push({ signal, resolve });
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
    await waitFor(() => expect(calls).toHaveLength(1));
    const first = calls[0];
    if (!first) throw new Error('loadMore was not called');
    expect(first.signal.aborted).toBe(false);
    return { user, editor, first };
  }

  it('aborts the signal of a pending loadMore when the suggestions close', async () => {
    const { user, first } = await startLoadMore();

    await user.keyboard('{Escape}');

    expect(first.signal.aborted).toBe(true);
  });

  it('aborts the signal of a pending loadMore when a newer query starts', async () => {
    const { editor, first } = await startLoadMore();

    act(() => {
      editor.commands.insertContent('x');
    });

    expect(first.signal.aborted).toBe(true);
  });

  it('aborts the signal of a pending loadMore when the input unmounts', async () => {
    const { first } = await startLoadMore();

    cleanup();

    expect(first.signal.aborted).toBe(true);
  });

  it('leaves the signal of a loadMore that resolved alone', async () => {
    const { user, first } = await startLoadMore();

    await act(async () => {
      first.resolve({ suggestions: page(['three']), hasMore: false });
    });
    await screen.findByRole('option', { name: /three/ });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    cleanup();

    expect(first.signal.aborted).toBe(false);
  });
  it('aborts the signal of a loadMore that runs past timeoutMs and reports the timeout once', async () => {
    const scrollToEnd = observeIntersections();
    const user = userEvent.setup();
    const onError = vi.fn<(error: Error, context: SuggestionErrorContext) => void>();
    const signals: AbortSignal[] = [];
    await renderInput({
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          timeoutMs: 50,
          suggest: async () => ({ suggestions: page(['one', 'two']), hasMore: true }),
          loadMore: ({ signal }) => {
            signals.push(signal);
            return new Promise<CustomSuggestionResult>(() => {});
          },
          onError,
        },
      },
    });
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: /one/ });
    act(scrollToEnd);

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[0]?.reason).toMatchObject({ name: 'TimeoutError' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[1]).toEqual({ type: 'loadMore', query: '' });
  });
});

describe('selecting a custom suggestion with onSelect', () => {
  const tokenField: FieldDefinition = {
    key: 'status',
    label: 'Status',
    type: 'string',
    operators: ['is'],
  };

  it('removes the typed text although onSelect moved the selection', async () => {
    const user = userEvent.setup();
    const { ref, editor } = await renderInput({
      fields: [tokenField],
      defaultValue: 'status:is:a',
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          suggest: () => customOptions,
          onSelect: () => {
            editor.commands.setTextSelection(1);
            return true;
          },
        },
      },
    });
    act(() => {
      editor.commands.focus('end');
      editor.commands.insertContent(' fir');
    });
    await user.click(await screen.findByRole('option', { name: /First/ }));

    await waitFor(() => expect(ref.current?.getValue()).toBe('status:is:a'));
  });

  it('removes the typed text and the token onSelect deletes in one undo step', async () => {
    const user = userEvent.setup();
    const { ref, editor } = await renderInput({
      fields: [tokenField],
      defaultValue: 'status:is:a',
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          suggest: () => customOptions,
          onSelect: (_suggestion, { existingTokens, deleteToken }) => {
            deleteToken(existingTokens[0].id);
            return true;
          },
        },
      },
    });
    act(() => {
      editor.commands.focus('end');
      editor.commands.insertContent(' fir');
      editor.view.dispatch(closeHistory(editor.state.tr));
    });
    await user.click(await screen.findByRole('option', { name: /First/ }));
    await waitFor(() => expect(ref.current?.getValue()).toBe(''));

    act(() => {
      editor.commands.undo();
    });

    expect(ref.current?.getValue()).toBe('status:is:a fir');
  });
});
