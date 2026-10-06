import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type {
  TokenizedSearchInputProps,
  TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input.types';
import { isContextUpdated } from '../../plugins/shared/meta';
import { getFocusedToken } from '../../plugins/token-focus';
import type { FieldDefinition } from '../../types';
import { datetimeField, extendedFields, statusField } from '../fixtures';
import { getInternalEditor, waitForEditor } from '../helpers/get-editor';
import { filterTokens } from '../helpers/token-queries';

afterEach(() => cleanup());

/**
 * Runs the timers pending under fake timers, then the microtasks queued so far, with
 * React's updates from them applied.
 */
async function runPendingTimers(): Promise<void> {
  await act(async () => {
    vi.runOnlyPendingTimers();
  });
}

describe('reactive configuration', () => {
  it('keeps the editor and content when configuration changes', async () => {
    const ref = { current: null as TokenizedSearchInputRef | null };
    const view = render(
      <TokenizedSearchInput ref={ref} fields={extendedFields} defaultValue="status:is:active" />
    );
    await waitFor(() => expect(ref.current).not.toBeNull());
    const editor = getInternalEditor(ref.current);
    expect(editor).not.toBeNull();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      view.rerender(
        <TokenizedSearchInput
          ref={ref}
          fields={extendedFields}
          freeTextMode="tokenize"
          defaultValue="ignored"
        />
      );
      await waitFor(() => expect(ref.current?.getValue()).toContain('status:is:active'));
      expect(getInternalEditor(ref.current)).toBe(editor);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('defaultValue changed'));
    } finally {
      warn.mockRestore();
    }
  });

  it('updates token class names and resets them', async () => {
    const onChange = vi.fn();
    const view = render(
      <TokenizedSearchInput
        fields={extendedFields}
        defaultValue="status:is:active"
        classNames={{ token: 'token-a' }}
        onChange={onChange}
      />
    );
    const token = await screen.findByText('active');
    expect(token.closest('[data-filter-token]')).toHaveClass('token-a');
    const stableCallCount = onChange.mock.calls.length;
    view.rerender(
      <TokenizedSearchInput
        fields={extendedFields}
        defaultValue="status:is:active"
        classNames={{ token: 'token-b' }}
        onChange={onChange}
      />
    );
    await waitFor(() => expect(token.closest('[data-filter-token]')).toHaveClass('token-b'));
    expect(onChange).toHaveBeenCalledTimes(stableCallCount);
    view.rerender(
      <TokenizedSearchInput
        fields={extendedFields}
        defaultValue="status:is:active"
        onChange={onChange}
      />
    );
    await waitFor(() => expect(token.closest('[data-filter-token]')).not.toHaveClass('token-b'));
    expect(onChange).toHaveBeenCalledTimes(stableCallCount);
  });

  it('uses the current clipboard serializer and resets to default', async () => {
    const serialize = (label: string) => () => label;
    const ref = { current: null as TokenizedSearchInputRef | null };
    const view = render(
      <TokenizedSearchInput
        ref={ref}
        fields={extendedFields}
        defaultValue="status:is:active"
        serialization={{ serializeToken: serialize('A') }}
      />
    );
    await waitFor(() => expect(ref.current).not.toBeNull());
    const editor = getInternalEditor(ref.current);
    if (!editor) throw new Error('editor unavailable');
    const slice = editor.state.doc.slice(0, editor.state.doc.content.size);
    const text = () =>
      editor.view.someProp('clipboardTextSerializer', (fn) => fn(slice, editor.view));
    expect(text()).toBe('A');
    view.rerender(
      <TokenizedSearchInput
        ref={ref}
        fields={extendedFields}
        defaultValue="status:is:active"
        serialization={{ serializeToken: serialize('B') }}
      />
    );
    await waitFor(() => expect(text()).toBe('B'));
    view.rerender(
      <TokenizedSearchInput ref={ref} fields={extendedFields} defaultValue="status:is:active" />
    );
    await waitFor(() => expect(text()).toBe('status:is:active'));
  });

  it('updates and resets the text deserializer for subsequent input', async () => {
    const parse = (key: string, value: string) => () => [
      { type: 'filter' as const, key, operator: 'is', value },
    ];
    const ref = { current: null as TokenizedSearchInputRef | null };
    const view = render(
      <TokenizedSearchInput
        ref={ref}
        fields={extendedFields}
        serialization={{ deserializeText: parse('status', 'A') }}
      />
    );
    await waitFor(() => expect(ref.current).not.toBeNull());
    const editor = getInternalEditor(ref.current);
    if (!editor) throw new Error('editor unavailable');
    act(() => {
      editor.commands.insertContent('first');
    });
    await waitFor(() => expect(ref.current?.getValue()).toContain('status:is:A'));
    act(() => {
      editor.commands.clearContent();
    });
    view.rerender(
      <TokenizedSearchInput
        ref={ref}
        fields={extendedFields}
        serialization={{ deserializeText: parse('priority', 'B') }}
      />
    );
    act(() => {
      editor.commands.insertContent('second');
    });
    await waitFor(() => expect(ref.current?.getValue()).toContain('priority:is:B'));
    act(() => {
      editor.commands.clearContent();
    });
    view.rerender(<TokenizedSearchInput ref={ref} fields={extendedFields} />);
    act(() => {
      editor.commands.insertContent('status:is:active');
    });
    await waitFor(() => expect(ref.current?.getValue()).toContain('status:is:active'));
  });
  it('resolves existing tokens as unknown fields once fields no longer define them', async () => {
    const labeledFields: FieldDefinition[] = [
      {
        key: 'status',
        label: 'Status',
        type: 'enum',
        operators: ['is'],
        enumValues: [{ value: 'active', label: 'Currently Active' }],
      },
    ];
    const view = render(
      <TokenizedSearchInput fields={labeledFields} defaultValue="status:is:active" />
    );
    expect(await screen.findByText('Currently Active')).toBeInTheDocument();
    view.rerender(<TokenizedSearchInput fields={[]} defaultValue="status:is:active" />);
    await waitFor(() => expect(screen.queryByText('Currently Active')).not.toBeInTheDocument());
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('keeps aria-disabled while disabled is toggled and other props change', async () => {
    const props = { fields: extendedFields, defaultValue: 'status:is:active' };
    const view = render(<TokenizedSearchInput {...props} disabled />);
    const combobox = screen.getByRole('combobox');
    await waitFor(() => expect(combobox).toHaveAttribute('aria-disabled', 'true'));
    view.rerender(<TokenizedSearchInput {...props} disabled={false} />);
    await waitFor(() => expect(combobox).not.toHaveAttribute('aria-disabled'));
    view.rerender(<TokenizedSearchInput {...props} disabled />);
    await waitFor(() => expect(combobox).toHaveAttribute('aria-disabled', 'true'));
    view.rerender(<TokenizedSearchInput {...props} disabled placeholder="Other" />);
    view.rerender(<TokenizedSearchInput {...props} disabled placeholder="Another" />);
    expect(combobox).toHaveAttribute('aria-disabled', 'true');
    expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not reapply editor options when unrelated props change', async () => {
    const props = { fields: extendedFields, defaultValue: 'status:is:active' };
    // useEditor re-applies its options from a timer it starts while mounting
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const setOptions = vi.spyOn(Editor.prototype, 'setOptions');
    try {
      const view = render(<TokenizedSearchInput {...props} />);
      screen.getByRole('combobox');
      await runPendingTimers();
      setOptions.mockClear();

      view.rerender(<TokenizedSearchInput {...props} placeholder="One" />);
      view.rerender(
        <TokenizedSearchInput {...props} placeholder="Two" classNames={{ root: 'x' }} />
      );
      view.rerender(<TokenizedSearchInput {...props} placeholder="Three" singleLine />);
      await runPendingTimers();
      expect(setOptions).not.toHaveBeenCalled();
    } finally {
      setOptions.mockRestore();
      vi.useRealTimers();
    }
  });

  it('tokenizes free text when the mode switches from plain to tokenize, outside the React commit', async () => {
    const ref = { current: null as TokenizedSearchInputRef | null };
    const element = (freeTextMode: 'plain' | 'tokenize') => (
      <TokenizedSearchInput
        ref={ref}
        fields={extendedFields}
        defaultValue="status:is:active hello"
        freeTextMode={freeTextMode}
      />
    );
    const view = render(element('plain'));
    await waitForEditor(ref);
    const freeTextCount = () =>
      ref.current?.getSnapshot().segments.filter((segment) => segment.type === 'freeText').length ??
      0;
    expect(freeTextCount()).toBe(0);

    view.rerender(element('tokenize'));

    await waitFor(() => expect(freeTextCount()).toBe(1));
    expect(ref.current?.getValue()).toBe('status:is:active hello');
  });

  it('creates the tokens of a held setValue outside the React commit', async () => {
    const ref = { current: null as TokenizedSearchInputRef | null };
    const view = render(<TokenizedSearchInput ref={ref} fields={extendedFields} />);
    await waitFor(() => expect(ref.current).not.toBeNull());
    getInternalEditor(ref.current)?.destroy();
    ref.current?.setValue('status:is:active');

    view.rerender(<TokenizedSearchInput ref={ref} fields={extendedFields} />);

    await waitFor(() => expect(view.container.querySelector('.tsi-token')).not.toBeNull());
    expect(ref.current?.getValue()).toBe('status:is:active');
  });

  it('runs a handle call made while held calls wait after them', async () => {
    const ref = { current: null as TokenizedSearchInputRef | null };
    const view = render(<TokenizedSearchInput ref={ref} fields={extendedFields} />);
    await waitFor(() => expect(ref.current).not.toBeNull());
    getInternalEditor(ref.current)?.destroy();
    ref.current?.setValue('first');

    view.rerender(<TokenizedSearchInput ref={ref} fields={extendedFields} />);
    ref.current?.setValue('second');

    expect(ref.current?.getValue()).toBe('second');
    await waitFor(() => expect(getInternalEditor(ref.current)?.getText()).toBe('second'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ref.current?.getValue()).toBe('second');
  });

  it('runs calls made through a handle of a destroyed editor on the live editor', async () => {
    const ref = { current: null as TokenizedSearchInputRef | null };
    const view = render(<TokenizedSearchInput ref={ref} fields={extendedFields} />);
    await waitFor(() => expect(ref.current).not.toBeNull());
    const stale = ref.current;
    if (!stale) throw new Error('no handle');
    getInternalEditor(stale)?.destroy();
    view.rerender(<TokenizedSearchInput ref={ref} fields={extendedFields} />);
    await waitFor(() => expect(getInternalEditor(ref.current)?.isDestroyed).toBe(false));
    await new Promise((resolve) => setTimeout(resolve, 0));

    stale.setValue('stale');
    ref.current?.setValue('live');

    await waitFor(() => expect(getInternalEditor(ref.current)?.getText()).toBe('live'));
    expect(ref.current?.getValue()).toBe('live');
    ref.current?.setValue('later');
    await waitFor(() => expect(getInternalEditor(ref.current)?.getText()).toBe('later'));
  });

  it('does not notify node views when the parent re-renders with equal configuration', async () => {
    const view = render(
      <TokenizedSearchInput
        fields={extendedFields}
        defaultValue="status:is:active"
        labels={{ pagination: { loading: 'Loading' } }}
        classNames={{ token: 'token-a' }}
      />
    );
    await screen.findByText('active');
    const editor = Editor.prototype;
    const dispatch = vi.spyOn(editor, 'emit');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      view.rerender(
        <TokenizedSearchInput
          fields={extendedFields}
          defaultValue="status:is:active"
          placeholder="Other"
          labels={{ pagination: { loading: 'Loading' } }}
          classNames={{ token: 'token-a' }}
        />
      );
      await runPendingTimers();
      const contextUpdates = dispatch.mock.calls.filter(
        ([event, payload]) =>
          event === 'transaction' &&
          isContextUpdated((payload as { transaction: Transaction }).transaction)
      );
      expect(contextUpdates).toHaveLength(0);
    } finally {
      dispatch.mockRestore();
      vi.useRealTimers();
    }
  });
  describe('handle calls held across a configuration change', () => {
    type Ref = { current: TokenizedSearchInputRef | null };
    type Mode = 'plain' | 'tokenize' | 'none';

    const freeTextCount = (ref: Ref) =>
      ref.current?.getSnapshot().segments.filter((segment) => segment.type === 'freeText').length ??
      0;

    async function runQueuedChanges(): Promise<void> {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    /** Waits for an editor other than `replaced` to be live and for its commit's changes. */
    async function settleOnReplacement(ref: Ref, replaced: Editor): Promise<Editor> {
      await waitFor(() => {
        const live = getInternalEditor(ref.current);
        expect(live && live !== replaced && !live.isDestroyed).toBe(true);
      });
      await runQueuedChanges();
      const live = getInternalEditor(ref.current);
      if (!live) throw new Error('editor is unavailable');
      return live;
    }

    async function heldSetValue(from: Mode, to: Mode, value: string): Promise<Ref> {
      const ref: Ref = { current: null };
      const element = (freeTextMode: Mode) => (
        <TokenizedSearchInput ref={ref} fields={extendedFields} freeTextMode={freeTextMode} />
      );
      const view = render(element(from));
      const destroyed = await waitForEditor(ref);
      destroyed.destroy();
      ref.current?.setValue(value);

      view.rerender(element(to));

      await settleOnReplacement(ref, destroyed);
      return ref;
    }

    it('reads a held setValue under plain mode when the mode switches from tokenize', async () => {
      const ref = await heldSetValue('tokenize', 'plain', 'status:is:active hello');

      expect(freeTextCount(ref)).toBe(0);
      expect(ref.current?.getValue()).toBe('status:is:active hello');
    });

    it('reads a held setValue under none mode when the mode switches from tokenize', async () => {
      const ref = await heldSetValue('tokenize', 'none', 'status:is:active hello');

      expect(freeTextCount(ref)).toBe(0);
      expect(ref.current?.getValue()).toBe('status:is:active');
    });

    it('keeps the free text tokens of a held setValue when the mode stays tokenize', async () => {
      const ref = await heldSetValue('tokenize', 'tokenize', 'status:is:active hello');

      expect(freeTextCount(ref)).toBe(1);
      expect(ref.current?.getValue()).toBe('status:is:active hello');
    });

    it('reads the content a held token write was made against under the new mode', async () => {
      const ref: Ref = { current: null };
      const element = (freeTextMode: Mode) => (
        <TokenizedSearchInput
          ref={ref}
          fields={extendedFields}
          defaultValue="status:is:active hello"
          freeTextMode={freeTextMode}
        />
      );
      const view = render(element('tokenize'));
      const destroyed = await waitForEditor(ref);
      const [status] = filterTokens(ref);
      destroyed.destroy();
      ref.current?.updateToken(status.id, { value: 'inactive' });

      view.rerender(element('plain'));

      await settleOnReplacement(ref, destroyed);
      expect(freeTextCount(ref)).toBe(0);
      expect(ref.current?.getValue()).toBe('status:is:inactive hello');
    });

    /**
     * Renders the input inside a parent whose effect, which runs after the input's own
     * effects of a commit, calls `onCommit` with a handle kept from a destroyed editor;
     * then makes a replacement editor live.
     */
    async function renderWithStaleHandle(
      props: TokenizedSearchInputProps,
      onCommit: (stale: TokenizedSearchInputRef, props: TokenizedSearchInputProps) => void
    ) {
      const ref: Ref = { current: null };
      let stale: TokenizedSearchInputRef | null = null;
      function Parent(parentProps: TokenizedSearchInputProps) {
        useEffect(() => {
          if (stale) onCommit(stale, parentProps);
        });
        return <TokenizedSearchInput ref={ref} {...parentProps} />;
      }
      const view = render(<Parent {...props} />);
      const destroyed = await waitForEditor(ref);
      stale = ref.current;
      destroyed.destroy();
      view.rerender(<Parent {...props} />);
      const live = await settleOnReplacement(ref, destroyed);
      const rerender = (next: TokenizedSearchInputProps) => view.rerender(<Parent {...next} />);
      return { ref, live, rerender };
    }

    it('reads the content under the new mode when a parent effect of that commit calls a stale handle', async () => {
      const props = {
        fields: extendedFields,
        defaultValue: 'status:is:active hello',
        freeTextMode: 'tokenize' as const,
      };
      const { ref, rerender } = await renderWithStaleHandle(props, (stale, current) => {
        if (current.freeTextMode === 'plain') stale.submit();
      });
      expect(freeTextCount(ref)).toBe(1);

      rerender({ ...props, freeTextMode: 'plain' });

      await runQueuedChanges();
      expect(freeTextCount(ref)).toBe(0);
      expect(ref.current?.getValue()).toBe('status:is:active hello');
    });

    it('leaves the focused token when a parent effect of the disabling commit calls a stale handle', async () => {
      const props = {
        fields: [statusField, datetimeField],
        defaultValue: 'updated:gt:2024-01-06T10:30:00+0900',
      };
      const { ref, live, rerender } = await renderWithStaleHandle(props, (stale, current) => {
        if (current.disabled) stale.focus();
      });
      const [updated] = filterTokens(ref);
      act(() => {
        live.commands.focusFilterToken(updated.id, 'end');
      });
      expect(getFocusedToken(live.state)?.id).toBe(updated.id);

      rerender({ ...props, disabled: true });

      await runQueuedChanges();
      expect(getFocusedToken(live.state)).toBeNull();
      expect(ref.current?.getValue()).toBe('updated:gt:2024-01-06T10:30:00+09:00');
    });
  });
});
