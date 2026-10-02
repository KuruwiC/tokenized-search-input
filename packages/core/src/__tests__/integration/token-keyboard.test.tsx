/**
 * Integration tests for keyboard handling inside a token: a key event is handled by
 * the one block that holds focus, and a block's dropdown owns the keys it uses.
 */

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { applyTokenAction } from '../../tokens/filter-token/token-actions';
import { statusField } from '../fixtures';
import { focusBlock, focusedTokenId, renderInput, tokenOf } from '../helpers/token-blocks';

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

    it('does not put a text input inside a button', async () => {
      const user = userEvent.setup();
      await renderInput('status:is:active', { unknownFields: {} });
      const group = screen.getByRole('group', { name: /status/i });
      const label = await focusBlock(user, group, 'Select field');

      await user.keyboard('{Enter}');

      await waitFor(() => expect(label).toHaveAttribute('aria-expanded', 'true'));
      expect(document.querySelector('button input')).toBeNull();
      expect(label).toHaveAttribute('role', 'combobox');
      expect(document.getElementById(label.getAttribute('aria-controls') ?? '')).toHaveAttribute(
        'role',
        'listbox'
      );
      expect(within(group).getByRole('textbox', { name: 'Field' })).toBeInTheDocument();
      expect(label.contains(document.activeElement)).toBe(true);
    });

    it('changes the field once when Tab picks the text of a combobox without a list', async () => {
      const user = userEvent.setup();
      const { ref } = await renderInput('status:is:active', {
        fields: [statusField],
        unknownFields: {},
      });
      const group = screen.getByRole('group', { name: /status/i });
      await focusBlock(user, group, 'Select field');

      await user.keyboard('{Enter}');
      await user.keyboard('custom');
      actions.setKeyCalls = 0;
      await user.keyboard('{Tab}');

      expect(actions.setKeyCalls).toBe(1);
      expect(tokenOf(ref)).toMatchObject({ key: 'custom' });
    });

    it('commits the typed text once when focus leaves the combobox', async () => {
      const user = userEvent.setup();
      const { ref } = await renderInput('status:is:active', { unknownFields: {} });
      const group = screen.getByRole('group', { name: /status/i });
      await focusBlock(user, group, 'Select field');

      await user.keyboard('{Enter}');
      await user.keyboard('custom');
      actions.setKeyCalls = 0;
      await user.click(document.body);

      expect(actions.setKeyCalls).toBe(1);
      expect(tokenOf(ref)).toMatchObject({ key: 'custom' });
    });

    it('drops the typed text on Escape', async () => {
      const user = userEvent.setup();
      const { ref } = await renderInput('status:is:active', { unknownFields: {} });
      const group = screen.getByRole('group', { name: /status/i });
      await focusBlock(user, group, 'Select field');

      await user.keyboard('{Enter}');
      await user.keyboard('custom');
      actions.setKeyCalls = 0;
      await user.keyboard('{Escape}{Escape}');

      expect(actions.setKeyCalls).toBe(0);
      expect(tokenOf(ref)).toMatchObject({ key: 'status' });
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
      const user = userEvent.setup();
      const { ref } = await renderInput('status:is:active', { unknownFields: {} });
      const group = screen.getByRole('group', { name: /status/i });
      await focusBlock(user, group, 'Select field');

      await user.keyboard('{Enter}');
      await user.keyboard('xq');
      actions.setKeyCalls = 0;
      await user.keyboard(keys);

      expect(actions.setKeyCalls).toBe(1);
      expect(tokenOf(ref)).toMatchObject({ key: 'xq' });
    });

    it('is committed once when the trigger is pressed', async () => {
      const user = userEvent.setup();
      const { ref } = await renderInput('status:is:active', { unknownFields: {} });
      const group = screen.getByRole('group', { name: /status/i });
      const label = await focusBlock(user, group, 'Select field');

      await user.keyboard('{Enter}');
      await user.keyboard('xq');
      actions.setKeyCalls = 0;
      await user.click(label);

      expect(actions.setKeyCalls).toBe(1);
      expect(tokenOf(ref)).toMatchObject({ key: 'xq' });
    });

    it('is not committed when the text was never edited', async () => {
      const user = userEvent.setup();
      const { ref } = await renderInput('status:is:active', { unknownFields: {} });
      const group = screen.getByRole('group', { name: /status/i });
      await focusBlock(user, group, 'Select field');

      await user.keyboard('{Enter}');
      actions.setKeyCalls = 0;
      await user.keyboard('{ArrowLeft}');

      expect(actions.setKeyCalls).toBe(0);
      expect(tokenOf(ref)).toMatchObject({ key: 'status' });
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

    it('leaves the token from the label, closed or open, without choosing a field', async () => {
      const user = userEvent.setup();
      const { ref, editor } = await renderInput('status:is:active');
      const group = screen.getByRole('group', { name: /status/i });
      await focusBlock(user, group, 'Select field');

      await user.keyboard(`{Enter}{ArrowDown}${shiftTab}`);

      expect(focusedTokenId(editor)).toBeUndefined();
      expect(tokenOf(ref)).toMatchObject({ key: 'status' });
    });
  });
});
