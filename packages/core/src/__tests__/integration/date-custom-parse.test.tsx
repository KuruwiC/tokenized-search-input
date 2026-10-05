/**
 * Integration tests for date fields with a custom `formatConfig.parse`: the parse reads
 * what the user types, the token stores the canonical form, and everything that reads the
 * stored value afterwards reads it as canonical.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { createRef, type RefObject } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { DateTimeValue } from '../../pickers/date-time-value';
import { getFocusedToken } from '../../plugins/token-focus';
import type { DateFieldDefinition, FieldDefinition } from '../../types';
import { statusField } from '../fixtures/fields';
import { waitForEditor } from '../helpers/get-editor';
import { invalidTokenCount } from '../helpers/token-queries';

afterEach(() => {
  cleanup();
});

const dayFirst = (input: string): DateTimeValue | null => {
  const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return { date: `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}` };
};

const dayFirstField: DateFieldDefinition = {
  key: 'created',
  label: 'Created',
  type: 'date',
  operators: ['gt'],
  formatConfig: {
    parse: dayFirst,
    format: (value) => {
      const [year, month, day] = value.date.split('-').map(Number);
      return `${day}/${month}/${year}`;
    },
  },
};

function firstFilter(editor: Editor): { id: string; value: string } {
  let found: { id: string; value: string } | undefined;
  editor.state.doc.descendants((node) => {
    if (!found && node.type.name === 'filterToken') {
      found = { id: String(node.attrs.id), value: String(node.attrs.value ?? '') };
    }
    return !found;
  });
  if (!found) throw new Error('no filter token');
  return found;
}

function renderInput(fields: FieldDefinition[], defaultValue?: string) {
  const ref = createRef<TokenizedSearchInputRef>();
  render(<TokenizedSearchInput ref={ref} fields={fields} defaultValue={defaultValue} />);
  return ref as RefObject<TokenizedSearchInputRef>;
}

describe('a date field with a custom parse', () => {
  it('stores what is typed in canonical form and does not mark the stored value', async () => {
    const user = userEvent.setup();
    const ref = renderInput([statusField, dayFirstField]);
    const editor = await waitForEditor(ref);
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('created:');
    await waitFor(() => expect(getFocusedToken(editor.state)).not.toBeNull());
    const input = document.activeElement as HTMLInputElement;
    await user.type(input, '5/3/2024');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(firstFilter(editor).value).toBe('2024-03-05'));
    await waitFor(() => expect(invalidTokenCount()).toBe(0));
  });

  it('accepts a stored canonical value given as the default value', async () => {
    renderInput([statusField, dayFirstField], 'created:gt:2024-03-05');
    await waitFor(() => expect(document.querySelectorAll('.node-filterToken').length).toBe(1));
    await waitFor(() => expect(invalidTokenCount()).toBe(0));
  });

  it('shows the stored value through the custom format', async () => {
    renderInput([statusField, dayFirstField], 'created:gt:2024-03-05');
    await waitFor(() => expect(screen.getByDisplayValue('5/3/2024')).toBeInTheDocument());
  });

  it('opens the picker on the stored date', async () => {
    const ref = renderInput([statusField, dayFirstField], 'created:gt:2024-03-05');
    const editor = await waitForEditor(ref);
    act(() => {
      editor.commands.focusFilterToken(firstFilter(editor).id, 'end');
    });
    await screen.findByRole('dialog');
    expect(screen.getByRole('gridcell', { selected: true })).toContainElement(
      screen.getByRole('button', { name: /March 5th, 2024/ })
    );
  });
});

describe('a picker that hands over a value that cannot be written', () => {
  const pickerField: DateFieldDefinition = {
    key: 'created',
    label: 'Created',
    type: 'date',
    operators: ['gt'],
    renderPicker: ({ onChange }) => (
      <div>
        <button type="button" onClick={() => onChange({ date: '2024-3-5' })}>
          loose
        </button>
        <button type="button" onClick={() => onChange({ date: '2024-02-31' })}>
          missing
        </button>
        <button type="button" onClick={() => onChange({ date: '2024-03-06' })}>
          good
        </button>
      </div>
    ),
  };

  async function open() {
    const ref = renderInput([statusField, pickerField], 'created:gt:2024-03-05');
    const editor = await waitForEditor(ref);
    act(() => {
      editor.commands.focusFilterToken(firstFilter(editor).id, 'end');
    });
    await screen.findByRole('dialog');
    return editor;
  }

  it('leaves the token as it was', async () => {
    const editor = await open();
    fireEvent.click(screen.getByRole('button', { name: 'loose' }));
    fireEvent.click(screen.getByRole('button', { name: 'missing' }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(firstFilter(editor).value).toBe('2024-03-05');
  });

  it('writes a value that can be written', async () => {
    const editor = await open();
    fireEvent.click(screen.getByRole('button', { name: 'good' }));
    await waitFor(() => expect(firstFilter(editor).value).toBe('2024-03-06'));
  });
});
