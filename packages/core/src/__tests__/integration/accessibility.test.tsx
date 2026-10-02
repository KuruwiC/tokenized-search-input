import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { FieldDefinition } from '../../types';

const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is'] },
  { key: 'owner', label: 'Owner', type: 'string', operators: ['is'] },
];

afterEach(cleanup);

describe('search input accessibility relationships', () => {
  it('places combobox relationships on the contenteditable and owns one listbox', async () => {
    const user = userEvent.setup();
    render(<TokenizedSearchInput fields={fields} />);
    const combobox = screen.getByRole('combobox');
    expect(combobox).toHaveAttribute('contenteditable', 'true');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).not.toHaveAttribute('aria-controls');
    expect(combobox).not.toHaveAttribute('aria-activedescendant');

    await user.click(combobox);
    await waitFor(() => expect(combobox).toHaveAttribute('aria-expanded', 'true'));

    const listboxes = screen.getAllByRole('listbox');
    expect(listboxes).toHaveLength(1);
    expect(combobox).toHaveAttribute('aria-controls', listboxes[0].id);
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(combobox).toHaveAttribute('aria-activedescendant'));
    const activeId = combobox.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId as string)).toHaveAttribute('role', 'option');
  });

  it('keeps controls and option ids unique across instances', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TokenizedSearchInput fields={fields} />
        <TokenizedSearchInput fields={fields} />
      </>
    );
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes).toHaveLength(2);
    await user.click(comboboxes[0]);
    await waitFor(() => expect(comboboxes[0]).toHaveAttribute('aria-expanded', 'true'));

    expect(document.querySelectorAll('[data-suggestion-root]')).toHaveLength(1);
    const listbox = screen.getByRole('listbox');
    expect(comboboxes[0].getAttribute('aria-controls')).toBe(listbox.id);
    expect(comboboxes[1].getAttribute('aria-controls')).not.toBe(listbox.id);
    const optionIds = [...listbox.querySelectorAll('[role="option"]')].map((el) => el.id);
    expect(new Set(optionIds).size).toBe(optionIds.length);
    expect(optionIds).not.toContain('');
    expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('exposes a date picker as one dialog controlled from the token input', async () => {
    const user = userEvent.setup();
    render(
      <TokenizedSearchInput
        fields={[{ key: 'created', label: 'Created', type: 'date', operators: ['gt'] }]}
        defaultValue="created:gt:2024-01-01"
      />
    );
    const token = await waitFor(() => {
      const element = document.querySelector('.tsi-token');
      expect(element).toBeInTheDocument();
      return element as HTMLElement;
    });

    await user.click(token);

    const dialog = await screen.findByRole('dialog');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    // The input that holds focus is the combobox; the editor reads as closed
    const controlling = document.querySelectorAll(`[aria-controls="${dialog.id}"]`);
    expect(controlling).toHaveLength(1);
    expect(controlling[0]).toHaveAttribute('role', 'combobox');
    expect(controlling[0]).toHaveAttribute('aria-haspopup', 'dialog');
    expect(controlling[0]).toBe(screen.getByLabelText('Value for created filter'));
    expect(dialog.querySelector('[data-date-picker]')).toBeInTheDocument();
  });
});
