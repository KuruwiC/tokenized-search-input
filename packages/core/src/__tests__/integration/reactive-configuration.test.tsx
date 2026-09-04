import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
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
        serialization={{ serializeToken: serialize('B') }}
      />
    );
    await waitFor(() => expect(text()).toBe('B'));
    view.rerender(<TokenizedSearchInput ref={ref} fields={extendedFields} />);
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
});
