/**
 * An enum token holds the option value. A value written for a field with static
 * options is resolved to the option it names; a value that names none stays as typed.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type RefObject } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { FieldDefinition, QuerySnapshotFilterToken } from '../../types';
import { enumResolvers } from '../../utils/enum-value';

afterEach(() => {
  cleanup();
});

const statusField: FieldDefinition = {
  key: 'status',
  label: 'Status',
  type: 'enum',
  operators: ['is'],
  enumValues: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'pending', label: 'Pending Review' },
  ],
};

async function renderStatus(
  field: FieldDefinition,
  defaultValue: string
): Promise<RefObject<TokenizedSearchInputRef>> {
  const ref = createRef<TokenizedSearchInputRef>();
  render(<TokenizedSearchInput ref={ref} fields={[field]} defaultValue={defaultValue} />);
  await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
  return ref as RefObject<TokenizedSearchInputRef>;
}

function tokens(ref: RefObject<TokenizedSearchInputRef>): QuerySnapshotFilterToken[] {
  return (ref.current?.getSnapshot().segments ?? []).filter(
    (segment): segment is QuerySnapshotFilterToken => segment.type === 'filter'
  );
}

async function updateValue(ref: RefObject<TokenizedSearchInputRef>, value: string) {
  const [token] = tokens(ref);
  act(() => {
    ref.current?.updateToken(token.id, { value });
  });
  return token.id;
}

describe('values written for an enum field with options', () => {
  it('stores the option value for a value in another case', async () => {
    const ref = await renderStatus(statusField, 'status:is:active');
    const id = await updateValue(ref, 'INACTIVE');
    expect(tokens(ref)[0]).toMatchObject({ id, value: 'inactive' });
  });

  it('stores the option value for the label of an option', async () => {
    const ref = await renderStatus(statusField, 'status:is:active');
    await updateValue(ref, 'pending review');
    expect(tokens(ref)[0].value).toBe('pending');
  });

  it('keeps a value that names no option as it was written', async () => {
    const ref = await renderStatus(statusField, 'status:is:active');
    await updateValue(ref, 'Archived');
    expect(tokens(ref)[0].value).toBe('Archived');
  });

  it('uses the resolver of the field', async () => {
    const ref = await renderStatus(
      { ...statusField, valueResolver: enumResolvers.exact } as FieldDefinition,
      'status:is:active'
    );
    await updateValue(ref, 'INACTIVE');
    expect(tokens(ref)[0].value).toBe('INACTIVE');
  });

  it('leaves the value of an enum field without static options as it was written', async () => {
    const dynamic: FieldDefinition = {
      key: 'status',
      label: 'Status',
      type: 'enum',
      operators: ['is'],
    };
    const ref = await renderStatus(dynamic, 'status:is:active');
    await updateValue(ref, 'INACTIVE');
    expect(tokens(ref)[0].value).toBe('INACTIVE');
  });

  it('stores the option value for a value typed as text', async () => {
    const user = userEvent.setup();
    const ref = await renderStatus(statusField, '');
    const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
    await user.click(combobox);
    await user.type(combobox, 'status:');
    await user.keyboard('INACTIVE');
    await waitFor(() => expect(tokens(ref).map((t) => t.value)).toEqual(['inactive']));
  });
});
