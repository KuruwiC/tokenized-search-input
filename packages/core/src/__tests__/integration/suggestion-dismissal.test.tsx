/**
 * Integration tests for what closes an open suggestion.
 */
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { getSuggestionState, openFieldSuggestion } from '../../plugins/suggestion';
import { fields, renderInput } from '../helpers/suggestion-layer';

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

    // The handlers of the value suggestion are still attached when the type changes
    editor.view.dispatch(openFieldSuggestion(editor.state.tr, fields, '', 1));
    fireEvent.focusIn(outside);

    expect(getSuggestionState(editor.state)?.type).toBe('field');
    await act(async () => {});
    outside.remove();
  });

  it('closes a value suggestion when focus moves outside it', async () => {
    const user = userEvent.setup();
    const { editor } = await renderInput({ defaultValue: 'status:is:a' });
    await user.click(screen.getByRole('group', { name: /Filter: status/i }));
    await screen.findByRole('listbox');
    const outside = document.createElement('button');
    document.body.append(outside);

    act(() => {
      fireEvent.focusIn(outside);
    });

    await waitFor(() => expect(getSuggestionState(editor.state)?.type).toBeNull());
    outside.remove();
  });
});
