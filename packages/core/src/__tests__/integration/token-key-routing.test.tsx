/**
 * Integration tests for which keys reach a token's blocks: keys of an input method that is
 * composing text reach nobody, and a key is handled by the block it was pressed in.
 */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plugin } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { focusBlock, focusedTokenId, renderInput } from '../helpers/token-blocks';

afterEach(() => {
  cleanup();
});

const composing = [
  ['isComposing', { isComposing: true }],
  ['keyCode 229', { keyCode: 229 }],
] as const;

describe.each(composing)('keys pressed while an input method composes (%s)', (_name, init) => {
  it.each([
    'Enter',
    'Escape',
    'Tab',
    'ArrowLeft',
    'ArrowRight',
  ])('%s does nothing in the value input', async (key) => {
    const user = userEvent.setup();
    const { editor } = await renderInput('status:is:active');
    const group = screen.getByRole('group', { name: /status/i });
    await user.click(group);
    const input = await waitFor(() => {
      const found = group.querySelector<HTMLInputElement>('.tsi-token-value__input');
      expect(found).toHaveFocus();
      return found as HTMLInputElement;
    });
    await user.keyboard('{Home}');
    const id = focusedTokenId(editor);

    const notPrevented = fireEvent.keyDown(input, { key, ...init });

    expect(notPrevented).toBe(true);
    expect(focusedTokenId(editor)).toBe(id);
    expect(input).toHaveFocus();
  });

  it.each([
    'Enter',
    'Escape',
    'Tab',
    'ArrowLeft',
    'ArrowRight',
  ])('%s does nothing in the label input', async (key) => {
    const user = userEvent.setup();
    const { editor, ref } = await renderInput('status:is:active', { unknownFields: {} });
    const group = screen.getByRole('group', { name: /status/i });
    await focusBlock(user, group, 'Select field');
    await user.keyboard('{Enter}');
    await user.keyboard('xq');
    const input = group.querySelector<HTMLInputElement>('.tsi-token-label-combobox__input');
    expect(input).toHaveFocus();
    const id = focusedTokenId(editor);

    const notPrevented = fireEvent.keyDown(input as HTMLInputElement, { key, ...init });

    expect(notPrevented).toBe(true);
    expect(group.querySelector('.tsi-token-label-combobox__input')).toBe(input);
    expect(input).toHaveValue('xq');
    expect(focusedTokenId(editor)).toBe(id);
    expect(ref.current?.getSnapshot().segments[0]).toMatchObject({ key: 'status' });
  });
});

describe('key routing', () => {
  it('leaves the keys of a focusable element that is not a block to that element', async () => {
    const user = userEvent.setup();
    const { editor } = await renderInput('status:is:active');
    const group = screen.getByRole('group', { name: /status/i });
    await user.click(group);
    await waitFor(() => expect(group.querySelector('.tsi-token-value__input')).toHaveFocus());
    const id = focusedTokenId(editor);
    // A view can put a control of its own among the blocks
    const consumer = document.createElement('button');
    group.querySelector('.tsi-token')?.appendChild(consumer);

    const notPrevented = fireEvent.keyDown(consumer, { key: 'Enter' });

    expect(notPrevented).toBe(true);
    expect(focusedTokenId(editor)).toBe(id);
  });

  it('keeps the keys pressed in a label out of ProseMirror', async () => {
    const user = userEvent.setup();
    const { editor } = await renderInput('status:is:active');
    const seen: string[] = [];
    editor.registerPlugin(
      new Plugin({
        props: {
          handleKeyDown: (_view, event) => {
            seen.push(event.key);
            return false;
          },
        },
      })
    );
    const group = screen.getByRole('group', { name: /status/i });
    const label = await focusBlock(user, group, 'Select field');
    seen.length = 0;

    fireEvent.keyDown(label, { key: 'ArrowDown' });

    expect(seen).toEqual([]);
  });
});
