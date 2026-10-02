import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { EDITOR_CONTEXT_UPDATED } from '../../extensions/editor-context';
import type { FieldDefinition } from '../../types';
import { extendedFields } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

afterEach(() => cleanup());

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
    const view = render(<TokenizedSearchInput {...props} />);
    await screen.findByRole('combobox');
    // useEditor re-applies its options once shortly after mount.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const setOptions = vi.spyOn(Editor.prototype, 'setOptions');
    try {
      view.rerender(<TokenizedSearchInput {...props} placeholder="One" />);
      view.rerender(
        <TokenizedSearchInput {...props} placeholder="Two" classNames={{ root: 'x' }} />
      );
      view.rerender(<TokenizedSearchInput {...props} placeholder="Three" singleLine />);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(setOptions).not.toHaveBeenCalled();
    } finally {
      setOptions.mockRestore();
    }
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
      await new Promise((resolve) => setTimeout(resolve, 20));
      const contextUpdates = dispatch.mock.calls.filter(
        ([event, payload]) =>
          event === 'transaction' &&
          (payload as { transaction: { getMeta: (key: string) => unknown } }).transaction.getMeta(
            EDITOR_CONTEXT_UPDATED
          )
      );
      expect(contextUpdates).toHaveLength(0);
    } finally {
      dispatch.mockRestore();
    }
  });
});
