/**
 * Integration tests for token focus: which token is edited, which of its blocks
 * receives DOM focus on entry, and how many transactions a focus move takes.
 */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { createRef, type RefObject } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { FieldDefinition } from '../../types';
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

function tokenGroup(name: RegExp): HTMLElement {
  return screen.getByRole('group', { name });
}

function valueInputOf(group: HTMLElement): HTMLInputElement {
  const input = group.querySelector('input');
  if (!input) throw new Error('token has no value input');
  return input;
}

describe('Token focus', () => {
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
