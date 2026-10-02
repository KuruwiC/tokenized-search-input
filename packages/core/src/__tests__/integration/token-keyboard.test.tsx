/**
 * Integration tests for keyboard handling inside a token: a key event is handled by
 * the one block that holds focus, and a block's dropdown owns the keys it uses.
 */

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { createRef, type RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { getFocusedToken } from '../../plugins/token-focus-plugin';
import type { applyTokenAction } from '../../tokens/filter-token/token-actions';
import type { FieldDefinition } from '../../types';
import { extendedFields } from '../fixtures';

const actions = vi.hoisted(() => ({ setKeyCalls: 0 }));

vi.mock('../../tokens/filter-token/token-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../tokens/filter-token/token-actions')>();
  const counted: typeof applyTokenAction = (tr, id, action, source) => {
    if (action.type === 'setKey') actions.setKeyCalls += 1;
    return actual.applyTokenAction(tr, id, action, source);
  };
  return { ...actual, applyTokenAction: counted };
});

afterEach(() => {
  cleanup();
  actions.setKeyCalls = 0;
});

async function renderInput(
  defaultValue: string,
  props: { fields?: FieldDefinition[]; unknownFields?: Record<string, never> } = {}
) {
  const ref = createRef<TokenizedSearchInputRef>();
  render(
    <TokenizedSearchInput
      ref={ref}
      fields={props.fields ?? extendedFields}
      unknownFields={props.unknownFields}
      defaultValue={defaultValue}
    />
  );
  await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
  const editor = ref.current?.getEditor();
  if (!editor) throw new Error('editor not ready');
  return { ref: ref as RefObject<TokenizedSearchInputRef>, editor };
}

function focusedTokenId(editor: Editor): string | undefined {
  return getFocusedToken(editor.state)?.id;
}

/**
 * Edits the token and walks left from its value to the block labelled `blockLabel`:
 * one step to the operator, two to the label.
 */
async function focusBlock(
  user: ReturnType<typeof userEvent.setup>,
  group: HTMLElement,
  blockLabel: 'Select operator' | 'Select field'
): Promise<HTMLElement> {
  await user.click(group);
  const block = await within(group).findByLabelText(blockLabel);
  await user.keyboard('{Home}');
  await user.keyboard(blockLabel === 'Select operator' ? '{ArrowLeft}' : '{ArrowLeft}{ArrowLeft}');
  expect(block).toHaveFocus();
  return block;
}

describe('Token keyboard handling', () => {
  describe('operator dropdown', () => {
    it('closes only the dropdown on Escape and keeps the token focused', async () => {
      const user = userEvent.setup();
      const { editor } = await renderInput('status:is:active');
      const group = screen.getByRole('group', { name: /status/i });
      const operator = await focusBlock(user, group, 'Select operator');
      const id = focusedTokenId(editor);
      expect(id).toBeDefined();

      await user.keyboard('{Enter}');
      expect(operator).toHaveAttribute('aria-expanded', 'true');

      await user.keyboard('{Escape}');

      expect(operator).toHaveAttribute('aria-expanded', 'false');
      expect(focusedTokenId(editor)).toBe(id);
      expect(operator).toHaveFocus();
    });

    it('leaves the token on Escape once the dropdown is closed', async () => {
      const user = userEvent.setup();
      const { editor } = await renderInput('status:is:active');
      const group = screen.getByRole('group', { name: /status/i });
      await focusBlock(user, group, 'Select operator');

      await user.keyboard('{Escape}');

      expect(focusedTokenId(editor)).toBeUndefined();
    });
  });

  describe('label combobox', () => {
    it('changes the field once when Tab picks an option in the text input', async () => {
      const user = userEvent.setup();
      const { ref } = await renderInput('status:is:active', { unknownFields: {} });
      const group = screen.getByRole('group', { name: /status/i });
      await focusBlock(user, group, 'Select field');

      await user.keyboard('{Enter}');
      await user.keyboard('{ArrowDown}');
      actions.setKeyCalls = 0;
      await user.keyboard('{Tab}');

      expect(actions.setKeyCalls).toBe(1);
      const token = ref.current?.getSnapshot().segments[0];
      expect(token).toMatchObject({ type: 'filter' });
      expect(token && 'key' in token ? token.key : undefined).not.toBe('status');
    });

    it('closes only the dropdown on Escape and keeps the token focused', async () => {
      const user = userEvent.setup();
      const { editor } = await renderInput('status:is:active');
      const group = screen.getByRole('group', { name: /status/i });
      const label = await focusBlock(user, group, 'Select field');
      const id = focusedTokenId(editor);

      await user.keyboard('{Enter}');
      expect(label).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{Escape}');

      expect(label).toHaveAttribute('aria-expanded', 'false');
      expect(focusedTokenId(editor)).toBe(id);
    });
  });
});
