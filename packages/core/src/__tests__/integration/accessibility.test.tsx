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

    const roots = document.querySelectorAll('[data-suggestion-root]');
    expect(roots).toHaveLength(1);
    const firstRoot = roots[0];
    expect(comboboxes[0].getAttribute('aria-controls')).toBe(firstRoot.id);
    expect(comboboxes[1].getAttribute('aria-controls')).not.toBe(firstRoot.id);
    const optionIds = [...firstRoot.querySelectorAll('[role="option"]')].map((el) => el.id);
    expect(new Set(optionIds).size).toBe(optionIds.length);
    expect(optionIds).not.toContain('');
    expect(within(firstRoot as HTMLElement).getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('exposes a date picker as one controlled dialog', async () => {
    const user = userEvent.setup();
    render(
      <TokenizedSearchInput
        fields={[{ key: 'created', label: 'Created', type: 'date', operators: ['gt'] }]}
        defaultValue="created:gt:2024-01-01"
      />
    );
    const combobox = screen.getByRole('combobox');
    const token = await waitFor(() => {
      const element = document.querySelector('.tsi-token');
      expect(element).toBeInTheDocument();
      return element as HTMLElement;
    });

    await user.click(token);

    const dialog = await screen.findByRole('dialog');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(combobox).toHaveAttribute('aria-haspopup', 'dialog');
    expect(combobox).toHaveAttribute('aria-controls', dialog.id);
    expect(dialog.querySelector('[data-date-picker]')).toBeInTheDocument();
  });
});
