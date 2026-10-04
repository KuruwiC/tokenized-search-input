/**
 * A query can name an operator the field of its key does not allow, such as
 * `status:contains:foo` on a field without `contains`. The token keeps what was written
 * and the validation plugin marks it.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { FieldDefinition } from '../../types';
import { statusField } from '../fixtures/fields';
import { getInternalEditor } from '../helpers/get-editor';

afterEach(() => {
  cleanup();
});

const invalidCount = () =>
  document.querySelectorAll('.node-filterToken [data-invalid="true"]').length;

describe('an operator the field does not allow', () => {
  it('stays on the token, which is marked invalid with the reason', async () => {
    const ref = createRef<TokenizedSearchInputRef>();
    render(
      <TokenizedSearchInput ref={ref} fields={[statusField]} defaultValue="status:contains:foo" />
    );

    await waitFor(() => expect(invalidCount()).toBe(1));
    expect(ref.current?.getSnapshot().segments).toMatchObject([
      {
        type: 'filter',
        key: 'status',
        operator: 'contains',
        value: 'foo',
        invalid: true,
        invalidReason: 'unknown-operator',
      },
    ]);
    expect(ref.current?.getSnapshot().text).toBe('status:contains:foo');
  });

  it('does not mark a token whose operator the field allows', async () => {
    render(<TokenizedSearchInput fields={[statusField]} defaultValue="status:is_not:active" />);

    await waitFor(() => expect(document.querySelectorAll('.node-filterToken')).toHaveLength(1));
    expect(invalidCount()).toBe(0);
  });

  it('can be switched off for a field like any rule', async () => {
    const lenient: FieldDefinition = { ...statusField, validation: { 'unknown-operator': false } };
    render(<TokenizedSearchInput fields={[lenient]} defaultValue="status:contains:foo" />);

    await waitFor(() => expect(document.querySelectorAll('.node-filterToken')).toHaveLength(1));
    expect(invalidCount()).toBe(0);
  });

  it('can be switched off for unknown fields through their template', async () => {
    render(
      <TokenizedSearchInput
        fields={[]}
        unknownFields={{ operators: ['is'], validation: { 'unknown-operator': false } }}
        defaultValue="custom:contains:foo"
      />
    );

    await waitFor(() => expect(document.querySelectorAll('.node-filterToken')).toHaveLength(1));
    expect(invalidCount()).toBe(0);
  });

  it('marks an unknown field whose template does not switch it off', async () => {
    render(
      <TokenizedSearchInput
        fields={[]}
        unknownFields={{ operators: ['is'] }}
        defaultValue="custom:contains:foo"
      />
    );

    await waitFor(() => expect(invalidCount()).toBe(1));
  });
});

describe('repairing an operator the field does not allow', () => {
  const single: FieldDefinition = {
    key: 'name',
    label: 'Name',
    type: 'string',
    operators: ['is'],
    hideSingleOperator: true,
  };

  it('shows the operator and offers the operators of a field that has only one', async () => {
    const user = userEvent.setup();
    const ref = createRef<TokenizedSearchInputRef>();
    render(<TokenizedSearchInput ref={ref} fields={[single]} defaultValue="name:contains:foo" />);

    await waitFor(() => expect(invalidCount()).toBe(1));
    const editor = getInternalEditor(ref.current);
    if (!editor) throw new Error('editor unavailable');
    const segment = ref.current?.getSnapshot().segments[0];
    if (segment?.type !== 'filter') throw new Error('filter token expected');
    editor.commands.focusFilterToken(segment.id, 'end');

    const trigger = await screen.findByRole('combobox', { name: 'Select operator' });
    expect(trigger).toHaveTextContent('contains');
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'is' }));

    await waitFor(() =>
      expect(ref.current?.getSnapshot().segments).toMatchObject([
        { type: 'filter', key: 'name', operator: 'is', value: 'foo' },
      ])
    );
    expect(ref.current?.getSnapshot().segments[0]).not.toHaveProperty('invalid', true);
  });

  it('keeps hiding the only operator of a token that holds it', async () => {
    render(<TokenizedSearchInput fields={[single]} defaultValue="name:is:foo" />);

    await waitFor(() => expect(document.querySelectorAll('.node-filterToken')).toHaveLength(1));
    expect(document.querySelector('.tsi-token-operator')).toBeNull();
  });
});
