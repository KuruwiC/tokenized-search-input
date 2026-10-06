/**
 * Integration tests for token focus: which token is edited, which of its blocks
 * receives DOM focus on entry, and how many transactions a focus move takes.
 */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { createRef, Profiler, type RefObject } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { getFocusedToken, getTokenFocusMeta } from '../../plugins/token-focus';
import type { FieldDefinition } from '../../types';
import { extendedFields } from '../fixtures';
import { waitForEditor } from '../helpers/get-editor';
import { filterTokens } from '../helpers/token-queries';

afterEach(() => {
  cleanup();
});

async function renderInput(defaultValue: string, fields: FieldDefinition[] = extendedFields) {
  const ref = createRef<TokenizedSearchInputRef>();
  const { container } = render(
    <TokenizedSearchInput ref={ref} fields={fields} defaultValue={defaultValue} />
  );
  await waitForEditor(ref);
  return { ref, container };
}

function getEditor(ref: RefObject<TokenizedSearchInputRef | null>): Editor {
  const editor = ref.current?.getEditor();
  if (!editor) throw new Error('editor not ready');
  return editor;
}

/**
 * Runs the animation frames requested so far, and the frames they request in turn, with
 * React's updates from them applied.
 */
async function flushFrames(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
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
      const [id] = filterTokens(ref).map((token) => token.id);

      act(() => {
        editor.commands.focusFilterToken(id, 'start');
      });

      const input = valueInputOf(tokenGroup(/status/i));
      await waitFor(() => expect(document.activeElement).toBe(input));
      await flushFrames();
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(0);
    });
  });

  describe('the editing state', () => {
    it('shows editing only while an editable block of the token holds focus', async () => {
      const user = userEvent.setup();
      const { ref, container } = await renderInput('status:is:active');
      const editor = getEditor(ref);
      const [id] = filterTokens(ref).map((token) => token.id);
      const group = tokenGroup(/status/i);
      const state = () => container.querySelector('.tsi-token')?.getAttribute('data-state');
      const deleteButton = () => group.querySelector('[data-token-block="delete"]');

      act(() => {
        editor.commands.focusFilterToken(id, 'end');
      });
      await waitFor(() => expect(document.activeElement).toBe(valueInputOf(group)));
      await waitFor(() => expect(state()).toBe('editing'));
      expect(group.getAttribute('aria-label')).toMatch(/Editing\./);

      await user.keyboard('{ArrowRight}');

      await waitFor(() => expect(document.activeElement).toBe(deleteButton()));
      expect(getFocusedToken(editor.state)?.id).toBe(id);
      await waitFor(() => expect(state()).toBe('idle'));
      expect(group.getAttribute('aria-label')).not.toMatch(/Editing/);

      await user.keyboard('{ArrowLeft}');

      await waitFor(() => expect(document.activeElement).toBe(valueInputOf(group)));
      await waitFor(() => expect(state()).toBe('editing'));
      expect(group.getAttribute('aria-label')).toMatch(/Editing\./);
    });
  });

  describe('the first commit after entry', () => {
    it('already shows the token as editing when the entry block is editable', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const commits: { focused: string | null; state: string | null; label: string | null }[] = [];
      const record = () => {
        const token = document.querySelector('.tsi-token');
        commits.push({
          focused: token?.getAttribute('data-focused') ?? null,
          state: token?.getAttribute('data-state') ?? null,
          label: token?.closest('[role="group"]')?.getAttribute('aria-label') ?? null,
        });
      };
      render(
        <Profiler id="input" onRender={record}>
          <TokenizedSearchInput ref={ref} fields={extendedFields} defaultValue="status:is:active" />
        </Profiler>
      );
      await waitForEditor(ref);
      const editor = getEditor(ref);
      const [id] = filterTokens(ref).map((token) => token.id);
      commits.length = 0;

      act(() => {
        editor.commands.focusFilterToken(id, 'end');
      });
      await waitFor(() => expect(document.activeElement).toBe(valueInputOf(tokenGroup(/status/i))));

      const focusedCommits = commits.filter((commit) => commit.focused === 'true');
      expect(focusedCommits.length).toBeGreaterThan(0);
      for (const commit of focusedCommits) {
        expect(commit.state).toBe('editing');
        expect(commit.label).toMatch(/Editing\./);
      }
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

    async function renderImmutableWithCaret(at: 'start' | 'end') {
      const user = userEvent.setup();
      const rendered = await renderInput('country:is:jp', fieldsWithImmutable);
      const editor = getEditor(rendered.ref);
      act(() => {
        editor.commands.focus(at);
      });
      await waitFor(() => expect(editor.isFocused).toBe(true));
      return { user, editor, ...rendered };
    }

    function deleteButtonOf(group: HTMLElement): HTMLElement {
      const button = group.querySelector<HTMLElement>('[data-token-block="delete"]');
      if (!button) throw new Error('token has no delete button');
      return button;
    }

    it('focuses the delete button of an immutable token that ArrowRight moves onto, without editing it', async () => {
      const { user, editor, container } = await renderImmutableWithCaret('start');

      await user.keyboard('{ArrowRight}');

      const group = tokenGroup(/country/i);
      await waitFor(() => expect(document.activeElement).toBe(deleteButtonOf(group)));
      expect(getFocusedToken(editor.state)).not.toBeNull();
      expect(container.querySelector('.tsi-token')?.getAttribute('data-state')).toBe('idle');
      expect(group.getAttribute('aria-label')).not.toMatch(/Editing/);
    });

    it('focuses the delete button of an immutable token that ArrowLeft moves onto', async () => {
      const { user } = await renderImmutableWithCaret('end');

      await user.keyboard('{ArrowLeft}');

      await waitFor(() =>
        expect(document.activeElement).toBe(deleteButtonOf(tokenGroup(/country/i)))
      );
    });

    it('deletes an immutable token with Space once ArrowRight has focused its delete button', async () => {
      const { user, ref } = await renderImmutableWithCaret('start');
      await user.keyboard('{ArrowRight}');
      await waitFor(() =>
        expect(document.activeElement).toBe(deleteButtonOf(tokenGroup(/country/i)))
      );

      await user.keyboard(' ');

      expect(filterTokens(ref).map((token) => token.id)).toHaveLength(0);
    });

    it('moves on past an immutable token with the next arrow press', async () => {
      const { user, editor } = await renderImmutableWithCaret('start');
      await user.keyboard('{ArrowRight}');
      await waitFor(() =>
        expect(document.activeElement).toBe(deleteButtonOf(tokenGroup(/country/i)))
      );

      await user.keyboard('{ArrowRight}');

      expect(getFocusedToken(editor.state)).toBeNull();
      expect(editor.state.selection.empty).toBe(true);
      expect(editor.state.selection.from).toBe(2);
      expect(editor.isFocused).toBe(true);
    });

    it('focuses the delete button of an immutable token that is clicked, and Space deletes it', async () => {
      const user = userEvent.setup();
      const { ref, container } = await renderInput('country:is:jp', fieldsWithImmutable);
      const group = tokenGroup(/country/i);

      await user.click(group);

      await waitFor(() => expect(document.activeElement).toBe(deleteButtonOf(group)));
      expect(container.querySelector('.tsi-token')?.getAttribute('data-state')).toBe('idle');

      await user.keyboard(' ');

      expect(filterTokens(ref).map((token) => token.id)).toHaveLength(0);
    });

    it('keeps the value of an immutable token when focus leaves it', async () => {
      const user = userEvent.setup();
      const lockedDatetime: FieldDefinition = {
        key: 'updated',
        label: 'Updated',
        type: 'datetime',
        operators: ['is'],
        immutable: true,
      };
      const { ref } = await renderInput('updated:is:"2024-01-06T10:30:00+0900"', [
        ...extendedFields,
        lockedDatetime,
      ]);
      const editor = getEditor(ref);
      const before = editor.state.doc.nodeAt(1)?.attrs.value;
      await user.click(tokenGroup(/updated/i));
      await waitFor(() => expect(getFocusedToken(editor.state)).not.toBeNull());

      await user.keyboard('{Escape}');

      expect(getFocusedToken(editor.state)).toBeNull();
      expect(editor.state.doc.nodeAt(1)?.attrs.value).toBe(before);
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
      await flushFrames();
      expect(document.activeElement).toBe(input);
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
