/**
 * Integration tests for what closes an open suggestion.
 */
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { getSuggestionState, openFieldSuggestion } from '../../plugins/suggestion';
import { customOptions, fields, renderInput } from '../helpers/suggestion-layer';

afterEach(cleanup);

describe('dismissal of a suggestion', () => {
  it('does not close a list of fields for a focus change meant for a value suggestion', async () => {
    const user = userEvent.setup();
    const { editor } = await renderInput({ defaultValue: 'status:is:a' });
    await user.click(screen.getByRole('group', { name: /Filter: status/i }));
    await screen.findByRole('listbox');
    expect(getSuggestionState(editor.state)?.type).toBe('value');
    const outside = document.createElement('button');
    document.body.append(outside);
    onTestFinished(() => outside.remove());

    // The handlers of the value suggestion are still attached when the type changes
    editor.view.dispatch(openFieldSuggestion(editor.state.tr, fields, '', 1));
    fireEvent.focusIn(outside);

    expect(getSuggestionState(editor.state)?.type).toBe('field');
    await act(async () => {});
  });

  it('closes a value suggestion when focus moves outside it', async () => {
    const user = userEvent.setup();
    const { editor } = await renderInput({ defaultValue: 'status:is:a' });
    await user.click(screen.getByRole('group', { name: /Filter: status/i }));
    await screen.findByRole('listbox');
    const outside = document.createElement('button');
    document.body.append(outside);
    onTestFinished(() => outside.remove());

    act(() => {
      fireEvent.focusIn(outside);
    });

    await waitFor(() => expect(getSuggestionState(editor.state)?.type).toBeNull());
  });

  describe('focusing the input again after a dismissal', () => {
    function outsideButton() {
      const outside = document.createElement('button');
      outside.textContent = 'Outside';
      document.body.append(outside);
      onTestFinished(() => outside.remove());
      return outside;
    }

    it('shows the field suggestions again', async () => {
      const user = userEvent.setup();
      const { editor } = await renderInput();
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);
      await screen.findByRole('option', { name: /Status/ });

      await user.click(outsideButton());
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
      expect(getSuggestionState(editor.state)?.dismissed).toBe(true);

      act(() => {
        combobox.focus();
      });

      expect(await screen.findByRole('option', { name: /Status/ })).toBeInTheDocument();
      expect(getSuggestionState(editor.state)?.dismissed).toBe(false);
    });

    it('asks for the custom suggestions again and shows them', async () => {
      const user = userEvent.setup();
      const suggest = vi.fn(() => customOptions);
      await renderInput({
        suggestions: { custom: { displayMode: 'replace', debounceMs: 0, suggest } },
      });
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);
      await screen.findByRole('option', { name: /First/ });
      const calls = suggest.mock.calls.length;

      await user.click(outsideButton());
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());

      act(() => {
        combobox.focus();
      });

      expect(await screen.findByRole('option', { name: /First/ })).toBeInTheDocument();
      expect(suggest.mock.calls.length).toBeGreaterThan(calls);
    });
  });
});
