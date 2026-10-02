/**
 * Integration tests for the one list that holds custom and field suggestions, and for the
 * markup of its options and groups.
 */
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { activeDescendant, customOptions, renderInput } from '../helpers/suggestion-layer';

afterEach(cleanup);

describe.each([
  'prepend',
  'append',
] as const)('custom and field suggestions (%s)', (displayMode) => {
  it('keeps aria-activedescendant on an existing option across the boundary', async () => {
    const user = userEvent.setup();
    await renderInput({
      suggestions: { custom: { displayMode, debounceMs: 0, suggest: () => customOptions } },
    });
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    const list = await screen.findByRole('listbox');
    await waitFor(() => expect(within(list).getAllByRole('option')).toHaveLength(5));
    const options = within(list).getAllByRole('option');
    const labels = options.map((option) => option.textContent ?? '');
    expect(labels.slice(...(displayMode === 'prepend' ? [0, 2] : [3, 5]))).toEqual([
      expect.stringContaining('First'),
      expect.stringContaining('Second'),
    ]);

    // One full turn plus the wrap to the first option
    for (let step = 0; step <= options.length; step++) {
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(combobox).toHaveAttribute('aria-activedescendant'));
      const active = activeDescendant(combobox);
      expect(active).toHaveAttribute('role', 'option');
      expect(active).toHaveAttribute('aria-selected', 'true');
      expect(list).toContainElement(active);
      expect(options.filter((option) => option.getAttribute('aria-selected') === 'true')).toEqual([
        active,
      ]);
    }
  });

  it('selects the option the keys moved to', async () => {
    const user = userEvent.setup();
    const { ref } = await renderInput({
      suggestions: { custom: { displayMode, debounceMs: 0, suggest: () => customOptions } },
    });
    await user.click(screen.getByRole('combobox'));
    const list = await screen.findByRole('listbox');
    await waitFor(() => expect(within(list).getAllByRole('option')).toHaveLength(5));

    // The first option is a custom suggestion when prepended and the first listed field
    // otherwise, which is the one of the first category
    await user.keyboard('{ArrowDown}{Enter}');

    if (displayMode === 'prepend') {
      await waitFor(() => expect(ref.current?.getValue()).toBe('owner:is:first'));
    } else {
      expect(await screen.findByRole('group', { name: /Filter: team/i })).toBeInTheDocument();
    }
  });
});

describe('grouped field suggestions', () => {
  it('names each category as the label of a group', async () => {
    const user = userEvent.setup();
    await renderInput();
    await user.click(screen.getByRole('combobox'));
    const list = await screen.findByRole('listbox');

    const groups = within(list).getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('aria-labelledby'))).not.toContain(null);
    expect(within(list).getByRole('group', { name: 'People' })).toContainElement(
      within(list).getByRole('option', { name: /Team/ })
    );
  });
});
