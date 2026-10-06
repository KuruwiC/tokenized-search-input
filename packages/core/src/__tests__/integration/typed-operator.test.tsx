/**
 * A filter typed into the editor in the query format reads as the same text pasted or
 * parsed: the word after the key is the operator when the query would read it as one.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { extendedFields } from '../fixtures';
import { waitForEditor } from '../helpers/get-editor';

afterEach(() => {
  cleanup();
});

async function renderInput(defaultValue?: string) {
  const ref = createRef<TokenizedSearchInputRef>();
  const view = render(
    <TokenizedSearchInput ref={ref} fields={extendedFields} defaultValue={defaultValue} />
  );
  const editor = await waitForEditor(ref);
  return { ref, editor, unmount: view.unmount };
}

/** The filter segments of a snapshot without their ids, which differ between inputs. */
function filtersOf(ref: React.RefObject<TokenizedSearchInputRef | null>) {
  return (ref.current?.getSnapshot().segments ?? []).map((segment) => {
    if (segment.type !== 'filter') return segment;
    const { id: _id, ...rest } = segment;
    return rest;
  });
}

/** How the editor reads `query` when it is the initial value. */
async function parsed(query: string) {
  const { ref, unmount } = await renderInput(query);
  const segments = filtersOf(ref);
  unmount();
  return segments;
}

function valueInput(): HTMLInputElement {
  const input = document.activeElement;
  if (!(input instanceof HTMLInputElement)) throw new Error('no token input holds focus');
  return input;
}

/** The operator and value of the first filter token, also while it has no value. */
function firstToken(editor: Editor): { operator: string; value: string } | undefined {
  let token: { operator: string; value: string } | undefined;
  editor.state.doc.descendants((node) => {
    if (!token && node.type.name === 'filterToken') {
      token = { operator: node.attrs.operator, value: node.attrs.value };
    }
    return true;
  });
  return token;
}

function endUndoStep(editor: Editor): void {
  act(() => {
    editor.view.dispatch(closeHistory(editor.state.tr));
  });
}

describe('typing a filter in the query format', () => {
  it.each([
    ['an operator the field allows', 'status:is_not:active'],
    ["the field's first operator", 'status:is:active'],
    ['an operator of a string field', 'assignee:contains:bo'],
    ['a default operator the field does not allow', 'assignee:is_not:bob'],
    ['a value that holds the delimiter', 'assignee:10:30'],
    ['a value whose first word is not an operator', 'assignee:matches:x'],
    ['a value that starts with an operator after the operator', 'assignee:is:contains:x'],
  ])('reads %s as the query does: %s', async (_, query) => {
    const user = userEvent.setup();
    const { ref } = await renderInput();
    await user.click(screen.getByRole('combobox'));
    await user.keyboard(`${query} `);

    expect(filtersOf(ref)).toEqual(await parsed(query));
  });

  it('keeps typing into the value once the operator is read', async () => {
    const user = userEvent.setup();
    const { ref, editor } = await renderInput();
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('assignee:contains:');

    expect(screen.getByLabelText('Value for assignee filter')).toHaveFocus();
    expect(valueInput().value).toBe('');
    expect(firstToken(editor)).toEqual({ operator: 'contains', value: '' });

    await user.keyboard('bob');
    expect(valueInput().value).toBe('bob');
    expect(ref.current?.getSnapshot().segments[0]).toMatchObject({
      operator: 'contains',
      value: 'bob',
    });
  });

  it('reads the operator from text pasted into the value', async () => {
    const user = userEvent.setup();
    const { editor } = await renderInput();
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('assignee:');
    await user.paste('contains:');

    expect(valueInput().value).toBe('');
    expect(firstToken(editor)).toEqual({ operator: 'contains', value: '' });
  });

  it('reads the operator after a field chosen from the suggestions', async () => {
    const user = userEvent.setup();
    const { ref } = await renderInput();
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('assig');
    await user.click(await screen.findByRole('option', { name: /Assignee/ }));
    await user.keyboard('contains:bob ');

    expect(ref.current?.getValue()).toBe('assignee:contains:bob');
  });

  it('keeps an operator chosen for the token while its value is typed', async () => {
    const user = userEvent.setup();
    const { ref } = await renderInput();
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('assignee:{ArrowLeft}');
    expect(screen.getByLabelText('Select operator')).toHaveFocus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}{ArrowRight}');
    expect(screen.getByLabelText('Value for assignee filter')).toHaveFocus();
    await user.keyboard('is:x ');

    expect(ref.current?.getSnapshot().segments[0]).toMatchObject({
      operator: 'contains',
      value: 'is:x',
    });
  });

  it('keeps a word typed at the start of a value the token already had', async () => {
    const user = userEvent.setup();
    const { ref } = await renderInput('assignee:bob');
    await user.click(screen.getByText('bob'));
    await user.keyboard('{Home}contains:');

    expect(valueInput().value).toBe('contains:bob');
    expect(ref.current?.getSnapshot().segments[0]).toMatchObject({
      operator: 'is',
      value: 'contains:bob',
    });
  });

  it('undoes the operator together with the delimiter that ended it, and reads it again', async () => {
    const user = userEvent.setup();
    const { ref, editor } = await renderInput();
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('assignee:contains');
    endUndoStep(editor);
    await user.keyboard(':');
    expect(firstToken(editor)).toEqual({ operator: 'contains', value: '' });

    await user.keyboard('{Control>}z{/Control}');
    await waitFor(() => expect(valueInput().value).toBe('contains'));
    expect(ref.current?.getSnapshot().segments[0]).toMatchObject({
      operator: 'is',
      value: 'contains',
    });

    await user.keyboard(':bob ');
    expect(ref.current?.getValue()).toBe('assignee:contains:bob');
  });
});
