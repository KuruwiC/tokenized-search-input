/**
 * Integration tests for where the open suggestion is placed under its container.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import { fields } from '../helpers/suggestion-layer';

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

function suggestionRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>('[data-suggestion-root]');
  if (!root) throw new Error('no suggestion is open');
  return root;
}

describe('suggestion placement', () => {
  it('hangs below the container by default', async () => {
    const user = userEvent.setup();
    render(<TokenizedSearchInput fields={fields} />);

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('listbox');

    expect(suggestionRoot()).toHaveClass('tsi-dropdown--top-full');
    expect(suggestionRoot().style.top).toBe('');
  });

  it('sits below the whole input when the container expands on focus and has focus', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(72);
    const user = userEvent.setup();
    render(<TokenizedSearchInput fields={fields} expandOnFocus />);

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('listbox');

    await waitFor(() => expect(suggestionRoot().style.top).toBe('72px'));
    expect(suggestionRoot()).not.toHaveClass('tsi-dropdown--top-full');
  });
});
