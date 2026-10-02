/**
 * Integration tests for the element that carries the combobox relationships while a value or
 * date suggestion is open: the token input that holds focus.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import { activeDescendant, renderInput } from '../helpers/suggestion-layer';

afterEach(cleanup);

describe('combobox relationships of a value suggestion', () => {
  it('puts them on the token input that holds focus', async () => {
    const user = userEvent.setup();
    await renderInput({ defaultValue: 'status:is:a' });
    const editorRoot = screen.getByRole('combobox', { name: 'Search query input' });

    await user.click(screen.getByRole('group', { name: /Filter: status/i }));
    const input = await screen.findByLabelText('Value for status filter');
    await waitFor(() => expect(input).toHaveFocus());
    const list = await screen.findByRole('listbox');

    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(editorRoot).toHaveAttribute('aria-expanded', 'false');
    expect(editorRoot).not.toHaveAttribute('aria-controls');

    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
    const active = activeDescendant(input);
    expect(active).toHaveAttribute('role', 'option');
    expect(list).toContainElement(active);
    expect(editorRoot).not.toHaveAttribute('aria-activedescendant');
  });

  it('takes them away from the input when the suggestions close', async () => {
    const user = userEvent.setup();
    await renderInput({ defaultValue: 'status:is:a' });

    await user.click(screen.getByRole('group', { name: /Filter: status/i }));
    const input = await screen.findByLabelText('Value for status filter');
    await screen.findByRole('listbox');
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(input).not.toHaveAttribute('role');
    expect(input).not.toHaveAttribute('aria-expanded');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('puts the dialog relationships of a date picker on the token input', async () => {
    const user = userEvent.setup();
    render(
      <TokenizedSearchInput
        fields={[{ key: 'created', label: 'Created', type: 'date', operators: ['gt'] }]}
        defaultValue="created:gt:2024-01-01"
      />
    );
    await user.click(await screen.findByRole('group', { name: /Filter: created/i }));
    const dialog = await screen.findByRole('dialog');
    const input = await screen.findByLabelText('Value for created filter');

    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-haspopup', 'dialog');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', dialog.id);
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });
});

describe('combobox relationships of a suggestion that shows nothing', () => {
  it('does not claim an open list while a value matches none of the suggestions', async () => {
    const user = userEvent.setup();
    await renderInput({ defaultValue: 'status:is:a' });
    const editorRoot = screen.getByRole('combobox', { name: 'Search query input' });

    await user.click(screen.getByRole('group', { name: /Filter: status/i }));
    const input = await screen.findByLabelText('Value for status filter');
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));

    await user.type(input, 'zzz');

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(input).not.toHaveAttribute('aria-controls');
    expect(input).not.toHaveAttribute('aria-expanded', 'true');
    expect(editorRoot).not.toHaveAttribute('aria-controls');
  });
});
