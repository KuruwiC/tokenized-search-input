/**
 * Integration tests for the accessibility markup of the operator and label dropdowns: which
 * element is the combobox, and how it points at the list and at the active option.
 */

import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { statusField } from '../fixtures';
import { focusBlock, renderInput } from '../helpers/token-blocks';

afterEach(() => {
  cleanup();
});

function listOf(trigger: HTMLElement): HTMLElement {
  const list = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
  if (!list) throw new Error('the trigger does not point at a list');
  return list;
}

function activeOption(list: HTMLElement): HTMLElement {
  const option = list.querySelector<HTMLElement>('[role="option"][data-active="true"]');
  if (!option) throw new Error('no active option');
  return option;
}

describe('operator dropdown', () => {
  it('is a combobox that names the list and the active option while open', async () => {
    const user = userEvent.setup();
    await renderInput('status:is:active');
    const group = screen.getByRole('group', { name: /status/i });
    const operator = await focusBlock(user, group, 'Select operator');
    expect(operator).toHaveAttribute('role', 'combobox');
    expect(operator).toHaveAttribute('aria-expanded', 'false');
    expect(operator).not.toHaveAttribute('aria-activedescendant');

    await user.keyboard('{Enter}');
    const list = listOf(operator);
    const options = within(list).getAllByRole('option');

    expect(operator).toHaveAttribute('aria-expanded', 'true');
    expect(options.map((option) => option.id)).toEqual(
      options.map((_, index) => `${list.id}-${index}`)
    );
    expect(operator).toHaveAttribute('aria-activedescendant', activeOption(list).id);

    await user.keyboard('{ArrowDown}');
    expect(operator).toHaveAttribute('aria-activedescendant', options[1]?.id);
  });
});

describe('label combobox without a text input', () => {
  it('is the combobox itself and names the active option while open', async () => {
    const user = userEvent.setup();
    await renderInput('status:is:active');
    const group = screen.getByRole('group', { name: /status/i });
    const label = await focusBlock(user, group, 'Select field');
    expect(label).toHaveAttribute('role', 'combobox');

    await user.keyboard('{Enter}{ArrowDown}');
    const list = listOf(label);

    expect(label).toHaveAttribute('aria-expanded', 'true');
    expect(label).toHaveAttribute('aria-activedescendant', activeOption(list).id);
    expect(activeOption(list).id).toMatch(new RegExp(`^${list.id}-\\d+$`));
  });
});

describe('label combobox with a text input', () => {
  it('moves the combobox to the input while the input is shown', async () => {
    const user = userEvent.setup();
    await renderInput('status:is:active', { unknownFields: {} });
    const group = screen.getByRole('group', { name: /status/i });
    const trigger = await focusBlock(user, group, 'Select field');

    await user.keyboard('{Enter}');
    const input = within(group).getByRole('combobox', { name: 'Select field' });

    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listOf(input).id);
    expect(input).toHaveAttribute('aria-activedescendant', activeOption(listOf(input)).id);
    expect(trigger).not.toHaveAttribute('role');
    expect(trigger).not.toHaveAttribute('aria-expanded');
    expect(trigger).not.toHaveAttribute('aria-label');
    expect(within(trigger).getAllByRole('combobox')).toEqual([input]);

    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('role', 'combobox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('label combobox without a list', () => {
  it('is a plain text input while the text is edited', async () => {
    const user = userEvent.setup();
    await renderInput('status:is:active', { fields: [statusField], unknownFields: {} });
    const group = screen.getByRole('group', { name: /status/i });
    const trigger = await focusBlock(user, group, 'Select field');

    await user.keyboard('{Enter}');
    const input = within(group).getByRole('textbox', { name: 'Field' });

    expect(input).toHaveFocus();
    expect(trigger.contains(input)).toBe(true);
    expect(within(trigger).queryByRole('combobox')).toBeNull();
    expect(trigger.querySelector('[aria-expanded]')).toBeNull();
    for (const element of [trigger, input]) {
      expect(element).not.toHaveAttribute('role', 'combobox');
      expect(element).not.toHaveAttribute('aria-expanded');
      expect(element).not.toHaveAttribute('aria-controls');
      expect(element).not.toHaveAttribute('aria-haspopup');
    }
  });
});
