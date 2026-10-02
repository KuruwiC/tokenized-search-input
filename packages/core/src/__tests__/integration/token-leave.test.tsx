/**
 * Integration tests for leaving a token: however focus leaves it, the token is
 * committed in the transaction that moves the focus.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { createRef, type RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputProps,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { getFocusedToken } from '../../plugins/token-focus-plugin';
import type { FieldDefinition, QuerySnapshotFilterToken } from '../../types';
import { dateField, statusField } from '../fixtures/fields';

afterEach(() => {
  cleanup();
});

const lockedDate: FieldDefinition = { ...dateField, immutable: true };

function renderInput(props: Partial<TokenizedSearchInputProps> = {}) {
  const ref = createRef<TokenizedSearchInputRef>();
  const rendered = render(
    <TokenizedSearchInput ref={ref} fields={[statusField, dateField]} {...props} />
  );
  return { ref: ref as RefObject<TokenizedSearchInputRef>, ...rendered };
}

async function editorOf(ref: RefObject<TokenizedSearchInputRef>): Promise<Editor> {
  await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
  const editor = ref.current?.getEditor();
  if (!editor) throw new Error('editor not ready');
  return editor;
}

function filterTokens(ref: RefObject<TokenizedSearchInputRef>): QuerySnapshotFilterToken[] {
  return (ref.current?.getSnapshot().segments ?? []).filter(
    (segment): segment is QuerySnapshotFilterToken => segment.type === 'filter'
  );
}

function tokenAttrs(editor: Editor, key: string): Record<string, unknown> | undefined {
  let attrs: Record<string, unknown> | undefined;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'filterToken' && node.attrs.key === key) attrs = node.attrs;
    return true;
  });
  return attrs;
}

describe('Leaving a token', () => {
  describe('confirming', () => {
    it('confirms a typed date with Enter in one change, normalised and committed', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { ref } = renderInput({ fields: [statusField, lockedDate], onChange });
      const editor = await editorOf(ref);
      await user.click(screen.getByRole('combobox'));
      await user.keyboard('created:');
      await waitFor(() => expect(getFocusedToken(editor.state)).not.toBeNull());
      const input = document.activeElement as HTMLInputElement;
      await user.type(input, '2024-1-6');

      onChange.mockClear();
      input.focus();
      await user.keyboard('{Enter}');

      expect(getFocusedToken(editor.state)).toBeNull();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(tokenAttrs(editor, 'created')).toMatchObject({ value: '2024-01-06', immutable: true });
    });

    async function selectValue(how: 'enter' | 'click') {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { ref, unmount } = renderInput({ onChange });
      const editor = await editorOf(ref);
      await user.click(screen.getByRole('combobox'));
      await user.keyboard('status:');
      await waitFor(() => expect(screen.getByText('active')).toBeInTheDocument());

      onChange.mockClear();
      if (how === 'enter') {
        await user.keyboard('{ArrowDown}{Enter}');
      } else {
        await user.click(screen.getByText('active'));
      }
      await waitFor(() => expect(getFocusedToken(editor.state)).toBeNull());
      const changes = onChange.mock.calls.length;
      const selected = ref.current?.getValue();

      act(() => {
        editor.commands.undo();
      });
      const undone = ref.current?.getValue();
      unmount();
      return { changes, selected, undone };
    }

    it('records a value chosen with Enter as a click on it does', async () => {
      const entered = await selectValue('enter');
      const clicked = await selectValue('click');

      expect(entered.selected).toBe('status:is:active');
      expect(entered.changes).toBe(1);
      expect(entered).toEqual(clicked);
    });
  });

  describe('when the focused token is replaced', () => {
    it('moves DOM focus out of the token into the editor', async () => {
      const user = userEvent.setup();
      const { ref, container } = renderInput({ defaultValue: 'status:is:active' });
      const editor = await editorOf(ref);
      await user.click(screen.getByRole('group', { name: /status/i }));
      await waitFor(() => expect(getFocusedToken(editor.state)).not.toBeNull());

      act(() => {
        ref.current?.setValue('status:is:pending');
      });

      expect(getFocusedToken(editor.state)).toBeNull();
      await waitFor(() =>
        expect(document.activeElement).toBe(container.querySelector('.ProseMirror'))
      );
    });
  });

  describe('a disabled editor', () => {
    it('does not focus a token', async () => {
      const user = userEvent.setup();
      const { ref } = renderInput({ defaultValue: 'status:is:active', disabled: true });
      const editor = await editorOf(ref);
      const [status] = filterTokens(ref);

      act(() => {
        editor.commands.focusFilterToken(status.id, 'end');
      });
      await user.click(screen.getByRole('group', { name: /status/i }));

      expect(getFocusedToken(editor.state)).toBeNull();
    });
  });

  describe('when focus moves to another token without a press', () => {
    it('commits the token a typed open quote moves focus away from', async () => {
      const { ref } = renderInput({
        defaultValue: 'created:gt:2024-1-6',
        freeTextMode: 'tokenize',
      });
      const editor = await editorOf(ref);
      const [created] = filterTokens(ref);
      act(() => {
        editor.commands.focusFilterToken(created.id, 'end');
      });

      act(() => {
        editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' "abc');
      });

      expect(getFocusedToken(editor.state)?.id).not.toBe(created.id);
      expect(getFocusedToken(editor.state)).not.toBeNull();
      expect(tokenAttrs(editor, 'created')?.value).toBe('2024-01-06');
    });

    it('commits the token undo moves focus away from to a restored empty token', async () => {
      const { ref } = renderInput({ defaultValue: 'created:gt:2024-1-6' });
      const editor = await editorOf(ref);
      const [created] = filterTokens(ref);
      const end = () => editor.state.doc.content.size - 1;
      act(() => {
        editor.commands.insertContentAt(end(), {
          type: 'filterToken',
          attrs: { key: 'status', operator: 'is', value: '' },
        });
      });
      act(() => {
        editor.view.dispatch(closeHistory(editor.state.tr));
        editor.commands.deleteRange({ from: end() - 1, to: end() });
      });
      expect(tokenAttrs(editor, 'status')).toBeUndefined();
      act(() => {
        editor.commands.focusFilterToken(created.id, 'end');
      });

      act(() => {
        editor.commands.undo();
      });

      expect(getFocusedToken(editor.state)?.id).toBe(tokenAttrs(editor, 'status')?.id);
      expect(tokenAttrs(editor, 'created')?.value).toBe('2024-01-06');
    });
  });
});
