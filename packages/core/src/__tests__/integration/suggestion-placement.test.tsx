/**
 * Integration tests for where the open suggestion is placed under its container.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { fields } from '../helpers/suggestion-layer';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  it('opens and follows a scroll in an environment without ResizeObserver', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const ref = createRef<TokenizedSearchInputRef>();
    const user = userEvent.setup();
    const { container } = render(<TokenizedSearchInput ref={ref} fields={fields} singleLine />);

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('listbox');
    const editor = ref.current?.getEditor();
    if (!editor) throw new Error('editor is unavailable');
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({
      left: 40,
      right: 40,
      top: 0,
      bottom: 0,
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 500, height: 32 })
    );

    const pm = container.querySelector('.ProseMirror');
    if (!pm) throw new Error('editor did not render');
    fireEvent.scroll(pm);

    await waitFor(() => expect(suggestionRoot().style.left).toBe('40px'));
  });
});
