/**
 * Integration tests for token focus: which token is edited, which of its blocks
 * receives DOM focus on entry, and how many transactions a focus move takes.
 */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { createRef, type RefObject } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { getFocusedToken, getTokenFocusMeta } from '../../plugins/token-focus-plugin';
import type { FieldDefinition, QuerySnapshotFilterToken } from '../../types';
import { extendedFields } from '../fixtures';

afterEach(() => {
  cleanup();
});

async function renderInput(defaultValue: string, fields: FieldDefinition[] = extendedFields) {
  const ref = createRef<TokenizedSearchInputRef>();
  const { container } = render(
    <TokenizedSearchInput ref={ref} fields={fields} defaultValue={defaultValue} />
  );
  await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
  return { ref: ref as RefObject<TokenizedSearchInputRef>, container };
}

function getEditor(ref: RefObject<TokenizedSearchInputRef>): Editor {
  const editor = ref.current?.getEditor();
  if (!editor) throw new Error('editor not ready');
  return editor;
}

function filterTokenIds(ref: RefObject<TokenizedSearchInputRef>): string[] {
  return (ref.current?.getSnapshot().segments ?? [])
    .filter((segment): segment is QuerySnapshotFilterToken => segment.type === 'filter')
    .map((segment) => segment.id);
}

function tokenGroup(name: RegExp): HTMLElement {
  return screen.getByRole('group', { name });
}

function valueInputOf(group: HTMLElement): HTMLInputElement {
  const input = group.querySelector('input');
  if (!input) throw new Error('token has no value input');
  return input;
}

/** Fields with one whose tokens become immutable once the user leaves them with a value. */
const fieldsWithImmutable: FieldDefinition[] = [
  ...extendedFields,
  { key: 'country', label: 'Country', type: 'string', operators: ['is'], immutable: true },
];

describe('Token focus', () => {
  describe('moving focus from one token to another', () => {
    it('takes one transaction to leave the edited token and one to focus the clicked one', async () => {
      const user = userEvent.setup();
      const { ref, container } = await renderInput('status:is:active', fieldsWithImmutable);
      const editor = getEditor(ref);
      act(() => {
        editor.commands.focus('end');
      });
      await waitFor(() => expect(editor.isFocused).toBe(true));
      await user.keyboard(' country:');
      await waitFor(() =>
        expect(document.activeElement).toBe(valueInputOf(tokenGroup(/country/i)))
      );
      await user.keyboard('jp');

      // Leaving and entering tokens is all that changes the token focus or the document.
      let transactions = 0;
      const count = ({ transaction }: { transaction: Transaction }) => {
        if (transaction.docChanged || getTokenFocusMeta(transaction)) transactions++;
      };
      editor.on('transaction', count);
      await user.click(tokenGroup(/status/i));
      await waitFor(() => expect(document.activeElement).toBe(valueInputOf(tokenGroup(/status/i))));
      editor.off('transaction', count);

      expect(container.querySelector('.tsi-token[data-immutable="true"]')).not.toBeNull();
      expect(transactions).toBeLessThanOrEqual(2);
    });
  });

  describe('programmatic focus', () => {
    it('puts the caret at the start of the value when asked to focus at the start', async () => {
      const { ref } = await renderInput('status:is:active');
      const editor = getEditor(ref);
      const [id] = filterTokenIds(ref);

      act(() => {
        editor.commands.focusFilterToken(id, 'start');
      });

      const input = valueInputOf(tokenGroup(/status/i));
      await waitFor(() => expect(document.activeElement).toBe(input));
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(0);
    });
  });

  describe('immutable tokens', () => {
    it('does not focus an immutable token that undo restored', async () => {
      const { ref, container } = await renderInput('country:is:" "', fieldsWithImmutable);
      const editor = getEditor(ref);
      expect(container.querySelector('.tsi-token[data-immutable="true"]')).not.toBeNull();

      act(() => {
        editor.commands.deleteRange({ from: 1, to: 2 });
      });
      expect(container.querySelector('.tsi-token')).toBeNull();

      act(() => {
        editor.commands.undo();
      });

      await waitFor(() =>
        expect(container.querySelector('.tsi-token[data-immutable="true"]')).not.toBeNull()
      );
      expect(container.querySelectorAll('.tsi-token[data-focused="true"]')).toHaveLength(0);
    });

    it('selects an immutable token that ArrowRight moves onto instead of editing it', async () => {
      const user = userEvent.setup();
      const { ref, container } = await renderInput('country:is:jp', fieldsWithImmutable);
      const editor = getEditor(ref);
      act(() => {
        editor.commands.focus('start');
      });
      await waitFor(() => expect(editor.isFocused).toBe(true));

      await user.keyboard('{ArrowRight}');

      expect(getFocusedToken(editor.state)).toBeNull();
      expect(editor.state.selection.from).toBe(1);
      expect(editor.state.selection.to).toBe(2);
      expect(container.querySelectorAll('.tsi-token[data-focused="true"]')).toHaveLength(0);
    });
  });

  describe('the block that receives focus on entry', () => {
    async function renderWithCaret(defaultValue: string, at: 'start' | 'end') {
      const user = userEvent.setup();
      const rendered = await renderInput(defaultValue);
      const editor = getEditor(rendered.ref);
      act(() => {
        editor.commands.focus(at);
      });
      await waitFor(() => expect(editor.isFocused).toBe(true));
      return { user, ...rendered };
    }

    it('ArrowRight into a token focuses its first block', async () => {
      const { user } = await renderWithCaret('status:is:active', 'start');

      await user.keyboard('{ArrowRight}');

      await waitFor(() => expect(document.activeElement).toHaveClass('tsi-token-label-combobox'));
      expect(tokenGroup(/status/i).contains(document.activeElement)).toBe(true);
    });

    it('ArrowLeft into a token focuses its last block', async () => {
      const { user } = await renderWithCaret('status:is:active', 'end');

      await user.keyboard('{ArrowLeft}');

      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /remove status/i }))
      );
    });

    it('Delete into a token focuses its value with the caret at the start', async () => {
      const { user } = await renderWithCaret('status:is:active', 'start');

      await user.keyboard('{Delete}');

      const input = valueInputOf(tokenGroup(/status/i));
      await waitFor(() => expect(document.activeElement).toBe(input));
      expect(input.selectionStart).toBe(0);
    });

    it('Backspace into a token focuses its value with the caret at the end', async () => {
      const { user } = await renderWithCaret('status:is:active', 'end');

      await user.keyboard('{Backspace}');

      const input = valueInputOf(tokenGroup(/status/i));
      await waitFor(() => expect(document.activeElement).toBe(input));
      expect(input.selectionStart).toBe(input.value.length);
    });
  });
});
