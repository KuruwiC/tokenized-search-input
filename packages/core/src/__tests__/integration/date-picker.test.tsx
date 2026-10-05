/**
 * Integration tests for the date and datetime pickers: what the picker shows is read from
 * the value of the token, and what it writes keeps the offset and the time of that value.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type RefObject } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type {
  TokenizedSearchInputProps,
  TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input.types';
import { localOffsetAt } from '../../pickers/date-time-value';
import { getFocusedToken } from '../../plugins/token-focus';
import { dateField, datetimeField, statusField } from '../fixtures/fields';
import { waitForEditor } from '../helpers/get-editor';

afterEach(() => {
  cleanup();
});

function renderInput(props: Partial<TokenizedSearchInputProps> = {}) {
  const ref = createRef<TokenizedSearchInputRef>();
  render(
    <TokenizedSearchInput ref={ref} fields={[statusField, dateField, datetimeField]} {...props} />
  );
  return ref as RefObject<TokenizedSearchInputRef>;
}

/** The first filter token of the document, which is there even while its value is empty. */
function firstFilter(ref: RefObject<TokenizedSearchInputRef>): { id: string; value: string } {
  const editor = ref.current?.getEditor();
  let found: { id: string; value: string } | undefined;
  editor?.state.doc.descendants((node) => {
    if (!found && node.type.name === 'filterToken') {
      found = { id: String(node.attrs.id), value: String(node.attrs.value ?? '') };
    }
    return !found;
  });
  if (!found) throw new Error('no filter token');
  return found;
}

/** Renders the input with one token, focuses it and waits for its picker. */
async function openPicker(defaultValue: string) {
  const ref = renderInput({ defaultValue });
  const editor = await waitForEditor(ref);
  act(() => {
    editor.commands.focusFilterToken(firstFilter(ref).id, 'end');
  });
  await screen.findByRole('dialog');
  return ref;
}

/** Starts a token for `updated` by typing, so its value is empty, and waits for its picker. */
async function openEmptyPicker() {
  const ref = renderInput();
  const editor = await waitForEditor(ref);
  await userEvent.setup().click(screen.getByRole('combobox'));
  await userEvent.setup().keyboard('updated:');
  await waitFor(() => expect(getFocusedToken(editor.state)).not.toBeNull());
  await screen.findByRole('dialog');
  return ref;
}

const tokenValue = (ref: RefObject<TokenizedSearchInputRef>) => firstFilter(ref).value;
const timeInput = () => document.querySelector('input[type="time"]') as HTMLInputElement;
const chooseDay = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('datetime picker', () => {
  it('keeps the offset and the time of the token when only the date is changed', async () => {
    const ref = await openPicker('updated:gt:2024-03-05T14:30:00+09:00');
    chooseDay(/March 10th, 2024/);
    await waitFor(() => expect(tokenValue(ref)).toBe('2024-03-10T14:30:00+09:00'));
  });

  it('shows 14:30 for a token that has seconds, milliseconds and Z', async () => {
    await openPicker('updated:gt:2024-03-05T14:30:45.123Z');
    expect(timeInput().value).toBe('14:30');
  });

  it('shows 00:00 for a token at midnight', async () => {
    await openPicker('updated:gt:2024-03-05T00:00');
    expect(timeInput().value).toBe('00:00');
  });

  it('keeps the seconds of the token when the date is changed', async () => {
    const ref = await openPicker('updated:gt:2024-03-05T14:30:45.123Z');
    chooseDay(/March 10th, 2024/);
    await waitFor(() => expect(tokenValue(ref)).toBe('2024-03-10T14:30:45.123Z'));
  });

  it('writes the time of the picker in the offset of the token', async () => {
    const ref = await openPicker('updated:gt:2024-03-05T14:30:00+09:00');
    fireEvent.change(timeInput(), { target: { value: '09:15' } });
    await waitFor(() => expect(tokenValue(ref)).toBe('2024-03-05T09:15:00+09:00'));
  });

  it('writes the same moment in UTC when UTC is turned on', async () => {
    const ref = await openPicker('updated:gt:2024-03-05T14:30:00+09:00');
    fireEvent.click(screen.getByLabelText('UTC'));
    await waitFor(() => expect(tokenValue(ref)).toBe('2024-03-05T05:30:00Z'));
    expect(screen.getByLabelText('UTC')).toBeChecked();
  });

  it('writes the same moment in the local offset when UTC is turned off', async () => {
    const ref = await openPicker('updated:gt:2024-03-05T14:30:00Z');
    expect(screen.getByLabelText('UTC')).toBeChecked();
    fireEvent.click(screen.getByLabelText('UTC'));
    const offset = localOffsetAt(new Date('2024-03-05T14:30:00Z'));
    await waitFor(() => expect(tokenValue(ref).endsWith(offset)).toBe(true));
    expect(new Date(tokenValue(ref)).toISOString()).toBe('2024-03-05T14:30:00.000Z');
  });

  it('keeps the UTC choice when the time is removed and added again', async () => {
    const ref = await openPicker('updated:gt:2024-03-05T14:30:00+09:00');
    fireEvent.click(screen.getByLabelText('UTC'));
    await waitFor(() => expect(tokenValue(ref)).toBe('2024-03-05T05:30:00Z'));

    fireEvent.click(screen.getByLabelText(/include time/i));
    await waitFor(() => expect(tokenValue(ref)).toBe('2024-03-05'));

    fireEvent.click(screen.getByLabelText(/include time/i));
    await waitFor(() => expect(tokenValue(ref)).toBe('2024-03-05T00:00:00Z'));
  });

  it('keeps the UTC and time controls while partial input is typed', async () => {
    const user = userEvent.setup();
    await openPicker('updated:gt:2024-03-05T14:30:00Z');
    expect(screen.getByLabelText('UTC')).toBeChecked();

    const input = document.activeElement as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '2024-07-04T1');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(screen.getByLabelText('UTC')).toBeChecked();
    expect(screen.getByLabelText(/include time/i)).toBeChecked();
    expect(timeInput()).toBeEnabled();
  });

  it('shows UTC as on only for a token in UTC', async () => {
    await openPicker('updated:gt:2024-03-05T14:30:00+09:00');
    expect(screen.getByLabelText('UTC')).not.toBeChecked();
  });

  it('adds midnight to a date when the time is included, and removes the time again', async () => {
    const ref = await openPicker('updated:gt:2024-03-05');
    expect(screen.getByLabelText(/include time/i)).not.toBeChecked();
    expect(timeInput()).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/include time/i));
    const offset = localOffsetAt(new Date(2024, 2, 5));
    await waitFor(() => expect(tokenValue(ref)).toBe(`2024-03-05T00:00:00${offset}`));
    expect(screen.getByLabelText(/include time/i)).toBeChecked();
    expect(timeInput()).toBeEnabled();

    fireEvent.click(screen.getByLabelText(/include time/i));
    await waitFor(() => expect(tokenValue(ref)).toBe('2024-03-05'));
  });

  it('starts a new value in UTC when UTC was chosen before a date', async () => {
    const ref = await openEmptyPicker();
    fireEvent.click(screen.getByLabelText(/include time/i));
    fireEvent.click(screen.getByLabelText('UTC'));
    await waitFor(() => expect(screen.getByLabelText('UTC')).toBeChecked());
    expect(tokenValue(ref)).toBe('');

    // The displayed month is the current one, as the token has no date: any cell in the middle of the grid
    fireEvent.click(screen.getAllByRole('button', { name: /\w+ \d+(st|nd|rd|th), \d{4}/ })[15]);
    await waitFor(() => expect(tokenValue(ref)).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/));
  });
});

describe('date picker', () => {
  it('writes the chosen day as a date', async () => {
    const ref = await openPicker('created:gt:2024-03-05');
    chooseDay(/March 10th, 2024/);
    await waitFor(() => expect(tokenValue(ref)).toBe('2024-03-10'));
  });
});
