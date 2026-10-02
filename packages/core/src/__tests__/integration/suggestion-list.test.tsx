/**
 * Integration tests for the one list that holds custom and field suggestions, and for the
 * markup of its options and groups.
 */
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSuggestionState } from '../../plugins/suggestion-plugin';
import type { CustomSuggestion } from '../../types';
import {
  activeDescendant,
  customOptions,
  fields,
  observeIntersections,
  page,
  renderInput,
} from '../helpers/suggestion-layer';

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

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

describe('the entries of the list', () => {
  it.each([
    'prepend',
    'append',
  ] as const)('selects the highlighted option after the selection moved (%s)', async (displayMode) => {
    const user = userEvent.setup();
    const { editor } = await renderInput({
      suggestions: {
        custom: {
          displayMode,
          debounceMs: 0,
          suggest: ({ query }) =>
            query === 'ow' ? customOptions : new Promise<CustomSuggestion[]>(() => {}),
        },
      },
    });
    const combobox = screen.getByRole('combobox', { name: 'Search query input' });
    await user.click(combobox);
    await user.keyboard('ow');
    await screen.findByRole('option', { name: /First/ });

    // A move of the selection re-evaluates the field suggestions without a document change
    act(() => {
      editor.commands.setTextSelection(editor.state.selection.from - 1);
    });
    await waitFor(() => expect(getSuggestionState(editor.state)?.customItems).toEqual([]));
    await user.keyboard('{ArrowDown}');

    const highlighted = activeDescendant(combobox).textContent ?? '';
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options.some((text) => /First|Second/.test(text ?? ''))).toBe(false);
    await user.keyboard('{Enter}');
    const picked = fields.find((candidate) => highlighted.includes(candidate.label));
    expect(
      await screen.findByRole('group', { name: new RegExp(`Filter: ${picked?.key}`, 'i') })
    ).toBeInTheDocument();
  });

  it('keeps the same entry highlighted when a page arrives before it', async () => {
    const scrollToEnd = observeIntersections();
    const user = userEvent.setup();
    await renderInput({
      suggestions: {
        custom: {
          displayMode: 'prepend',
          debounceMs: 0,
          suggest: async () => ({ suggestions: page(['one', 'two']), hasMore: true }),
          loadMore: async () => ({ suggestions: page(['three', 'four']), hasMore: false }),
        },
      },
    });
    const combobox = screen.getByRole('combobox', { name: 'Search query input' });
    await user.click(combobox);
    await screen.findByRole('option', { name: /one/ });
    // The first option after the custom ones is the first field
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    const highlighted = activeDescendant(combobox).textContent;
    expect(highlighted).not.toMatch(/one|two/);

    act(scrollToEnd);
    await screen.findByRole('option', { name: /four/ });

    expect(activeDescendant(combobox).textContent).toBe(highlighted);
  });

  it('keeps identical custom suggestions apart and their rows mounted when a page arrives', async () => {
    const scrollToEnd = observeIntersections();
    const user = userEvent.setup();
    await renderInput({
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          suggest: async () => ({ suggestions: page(['same', 'same']), hasMore: true }),
          loadMore: async () => ({ suggestions: page(['next']), hasMore: false }),
        },
      },
    });
    await user.click(screen.getByRole('combobox', { name: 'Search query input' }));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    const [first] = screen.getAllByRole('option');

    act(scrollToEnd);
    await screen.findByRole('option', { name: /next/ });

    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getAllByRole('option')[0]).toBe(first);
  });
});

describe('what the listbox owns', () => {
  it('holds only options and groups, with the labels and dividers inside the groups', async () => {
    const user = userEvent.setup();
    await renderInput({
      suggestions: {
        custom: {
          displayMode: 'prepend',
          debounceMs: 0,
          suggest: async () => ({ suggestions: page(['one']), hasMore: true }),
        },
      },
    });
    await user.click(screen.getByRole('combobox', { name: 'Search query input' }));
    await screen.findByRole('option', { name: /one/ });
    const listbox = screen.getByRole('listbox');

    const roles = [...listbox.children].map((child) => child.getAttribute('role') ?? child.tagName);
    expect(
      roles.filter((role) => role !== 'option' && role !== 'group' && role !== 'FIELDSET')
    ).toEqual([]);
    for (const group of within(listbox).getAllByRole('group')) {
      const labelId = group.getAttribute('aria-labelledby');
      if (labelId) expect(group).toContainElement(document.getElementById(labelId));
    }
    expect(within(listbox).queryByRole('separator')).toBeInTheDocument();
  });

  it('puts the row that loads more outside the listbox', async () => {
    const user = userEvent.setup();
    await renderInput({
      suggestions: {
        custom: {
          displayMode: 'replace',
          debounceMs: 0,
          suggest: async () => ({ suggestions: page(['one']), hasMore: true }),
        },
      },
    });
    await user.click(screen.getByRole('combobox', { name: 'Search query input' }));
    await screen.findByRole('option', { name: /one/ });

    const row = screen.getByText('Scroll for more');
    expect(screen.getByRole('listbox')).not.toContainElement(row);
  });
});
