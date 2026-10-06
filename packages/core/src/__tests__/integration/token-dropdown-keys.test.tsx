/**
 * Integration tests for the keys of a token's operator and label dropdowns: a key event is
 * handled by the one block that holds focus, and a block's dropdown owns the keys it uses.
 * The markup of the dropdowns is covered in token-dropdown-aria.test.tsx.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act, createRef, type RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import type { FieldDefinition } from '../../types';
import { extendedFields, statusField } from '../fixtures';
import { waitForEditor } from '../helpers/get-editor';
import { focusBlock, focusedTokenId, renderInput, tokenOf } from '../helpers/token-blocks';

afterEach(cleanup);

/** An earlier field whose label is, case aside, the key of a later field. */
const authorFields: FieldDefinition[] = [
  statusField,
  { key: 'reporter', label: 'Author', type: 'string', operators: ['is'] },
  { key: 'author', label: 'Writer', type: 'string', operators: ['is'] },
];

/**
 * Renders the input with unknown fields allowed and opens the label combobox of its token,
 * then starts counting the changes it reports.
 */
async function openLabelCombobox(fields: FieldDefinition[] = extendedFields) {
  const user = userEvent.setup();
  const ref = createRef<TokenizedSearchInputRef>();
  const onChange = vi.fn();
  render(
    <TokenizedSearchInput
      ref={ref}
      fields={fields}
      unknownFields={{}}
      defaultValue="status:is:active"
      onChange={onChange}
    />
  );
  const editor = await waitForEditor(ref);
  const group = screen.getByRole('group', { name: /status/i });
  const label = await focusBlock(user, group, 'Select field');
  await user.keyboard('{Enter}');
  onChange.mockClear();
  return { user, ref: ref as RefObject<TokenizedSearchInputRef>, editor, label, onChange };
}

/** One undo takes the token back to the field it had before the combobox was opened. */
function expectOneUndoRestores(
  m: Awaited<ReturnType<typeof openLabelCombobox>>,
  value: string
): void {
  act(() => {
    m.editor.commands.undo();
  });
  expect(m.ref.current?.getValue()).toBe(value);
}

describe('Token dropdown keys', () => {
  describe('operator dropdown keys', () => {
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

    it('selects the active operator with Enter and keeps the focus on the operator', async () => {
      const user = userEvent.setup();
      const { ref } = await renderInput('status:is:active');
      const group = screen.getByRole('group', { name: /status/i });
      const operator = await focusBlock(user, group, 'Select operator');

      await user.keyboard('{Enter}{ArrowDown}{Enter}');

      expect(operator).toHaveAttribute('aria-expanded', 'false');
      expect(operator).toHaveFocus();
      expect(tokenOf(ref)).toMatchObject({ operator: 'is_not' });
    });

    it('moves the active operator back up with ArrowUp and stops at the first', async () => {
      const user = userEvent.setup();
      const { ref } = await renderInput('status:is_not:active');
      const group = screen.getByRole('group', { name: /status/i });
      await focusBlock(user, group, 'Select operator');

      await user.keyboard('{Enter}{ArrowUp}{ArrowUp} ');

      expect(tokenOf(ref)).toMatchObject({ operator: 'is' });
    });

    it('closes the dropdown on Tab and moves to the value', async () => {
      const user = userEvent.setup();
      const { editor } = await renderInput('status:is:active');
      const group = screen.getByRole('group', { name: /status/i });
      const operator = await focusBlock(user, group, 'Select operator');
      const id = focusedTokenId(editor);

      await user.keyboard('{Enter}{Tab}');

      expect(operator).toHaveAttribute('aria-expanded', 'false');
      expect(within(group).getByLabelText(/Value for status/)).toHaveFocus();
      expect(focusedTokenId(editor)).toBe(id);
    });

    it('picks an operator with the pointer and moves on to the value', async () => {
      const user = userEvent.setup();
      const { ref, editor } = await renderInput('status:is:active');
      const group = screen.getByRole('group', { name: /status/i });
      const operator = await focusBlock(user, group, 'Select operator');
      const id = focusedTokenId(editor);

      await user.click(operator);
      expect(operator).toHaveAttribute('aria-controls');
      await user.click(await screen.findByRole('option', { name: /is not/i }));

      expect(tokenOf(ref)).toMatchObject({ operator: 'is_not' });
      expect(focusedTokenId(editor)).toBe(id);
      expect(within(group).getByLabelText(/Value for status/)).toHaveFocus();
    });

    it('moves focus with the arrow keys and leaves the token before the first block', async () => {
      const user = userEvent.setup();
      const { editor } = await renderInput('status:is:active');
      const group = screen.getByRole('group', { name: /status/i });
      const operator = await focusBlock(user, group, 'Select operator');

      await user.keyboard('{ArrowRight}');
      expect(within(group).getByLabelText(/Value for status/)).toHaveFocus();

      await user.keyboard('{Home}{ArrowLeft}');
      expect(operator).toHaveFocus();
      await user.keyboard('{ArrowLeft}{ArrowLeft}');

      expect(focusedTokenId(editor)).toBeUndefined();
    });
  });

  describe('label combobox keys', () => {
    it('changes the field once when Tab picks an option in the text input', async () => {
      const m = await openLabelCombobox();

      await m.user.keyboard('{ArrowDown}');
      await m.user.keyboard('{Tab}');

      expect(m.onChange).toHaveBeenCalledTimes(1);
      const token = tokenOf(m.ref);
      expect(token).toMatchObject({ type: 'filter' });
      expect(token && 'key' in token ? token.key : undefined).not.toBe('status');
      expectOneUndoRestores(m, 'status:is:active');
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

    it('changes the field once when Tab picks the text of a combobox without a list', async () => {
      const m = await openLabelCombobox([statusField]);

      await m.user.keyboard('custom');
      await m.user.keyboard('{Tab}');

      expect(m.onChange).toHaveBeenCalledTimes(1);
      expect(tokenOf(m.ref)).toMatchObject({ key: 'custom' });
      expectOneUndoRestores(m, 'status:is:active');
    });

    it('commits the typed text once when focus leaves the combobox', async () => {
      const m = await openLabelCombobox();

      await m.user.keyboard('custom');
      await m.user.click(document.body);

      expect(m.onChange).toHaveBeenCalledTimes(1);
      expect(tokenOf(m.ref)).toMatchObject({ key: 'custom' });
      expectOneUndoRestores(m, 'status:is:active');
    });

    it('drops the typed text on Escape', async () => {
      const m = await openLabelCombobox();

      await m.user.keyboard('custom');
      await m.user.keyboard('{Escape}{Escape}');

      expect(m.onChange).not.toHaveBeenCalled();
      expect(m.ref.current?.getValue()).toBe('status:is:active');
    });
  });

  describe('a field chosen from the label combobox list', () => {
    it('is the field chosen, even when its key is the label of an earlier field', async () => {
      const m = await openLabelCombobox(authorFields);

      await m.user.click(screen.getByRole('option', { name: /Writer/ }));

      expect(tokenOf(m.ref)).toMatchObject({ key: 'author' });
    });
  });

  describe('free text typed into the label combobox', () => {
    it.each([
      ['Tab', '{Tab}'],
      ['Enter', '{Enter}'],
      ['ArrowRight', '{ArrowRight}'],
      ['ArrowLeft', '{ArrowLeft}'],
      ['Shift+Tab', '{Shift>}{Tab}{/Shift}'],
    ])('is committed once when the combobox is left with %s', async (_name, keys) => {
      const m = await openLabelCombobox();

      await m.user.keyboard('xq');
      await m.user.keyboard(keys);

      expect(m.onChange).toHaveBeenCalledTimes(1);
      expect(tokenOf(m.ref)).toMatchObject({ key: 'xq' });
      expectOneUndoRestores(m, 'status:is:active');
    });

    it('is committed once when the trigger is pressed', async () => {
      const m = await openLabelCombobox();

      await m.user.keyboard('xq');
      await m.user.click(m.label);

      expect(m.onChange).toHaveBeenCalledTimes(1);
      expect(tokenOf(m.ref)).toMatchObject({ key: 'xq' });
      expectOneUndoRestores(m, 'status:is:active');
    });

    it('names the field whose key it is over an earlier field with that label', async () => {
      const m = await openLabelCombobox(authorFields);

      await m.user.keyboard('author');
      await m.user.keyboard('{ArrowLeft}');

      expect(tokenOf(m.ref)).toMatchObject({ key: 'author' });
    });

    it('is not committed when the text was never edited', async () => {
      const m = await openLabelCombobox();

      await m.user.keyboard('{ArrowLeft}');

      expect(m.onChange).not.toHaveBeenCalled();
      expect(m.ref.current?.getValue()).toBe('status:is:active');
    });
  });

  describe('Shift+Tab', () => {
    const shiftTab = '{Shift>}{Tab}{/Shift}';

    it('moves from a closed operator to the label', async () => {
      const user = userEvent.setup();
      const { editor } = await renderInput('status:is:active');
      const group = screen.getByRole('group', { name: /status/i });
      await focusBlock(user, group, 'Select operator');

      await user.keyboard(shiftTab);

      expect(within(group).getByLabelText('Select field')).toHaveFocus();
      expect(focusedTokenId(editor)).toBeDefined();
    });

    it('closes an open operator and moves to the label without choosing', async () => {
      const user = userEvent.setup();
      const { ref } = await renderInput('status:is:active');
      const group = screen.getByRole('group', { name: /status/i });
      const operator = await focusBlock(user, group, 'Select operator');

      await user.keyboard('{Enter}{ArrowDown}');
      await user.keyboard(shiftTab);

      expect(operator).toHaveAttribute('aria-expanded', 'false');
      expect(within(group).getByLabelText('Select field')).toHaveFocus();
      expect(tokenOf(ref)).toMatchObject({ operator: 'is' });
    });

    it.each([
      ['closed', shiftTab],
      ['open', `{Enter}{ArrowDown}${shiftTab}`],
    ])('leaves the token from the %s label without choosing a field', async (_state, keys) => {
      const user = userEvent.setup();
      const { ref, editor } = await renderInput('status:is:active');
      const group = screen.getByRole('group', { name: /status/i });
      await focusBlock(user, group, 'Select field');

      await user.keyboard(keys);

      expect(focusedTokenId(editor)).toBeUndefined();
      expect(tokenOf(ref)).toMatchObject({ key: 'status' });
    });
  });
});
